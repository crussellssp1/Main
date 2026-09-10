import { NextRequest, NextResponse } from "next/server";
import { cached, isFresh, peek, put } from "@/lib/cache";
import { getJson, pool } from "@/lib/http";
import { SYMBOL_ALIASES } from "@/lib/sources";
import type { ApiEnvelope, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Quotes come from two upstream calls with very different costs.
 *
 * 1. The batch `spark` endpoint returns last price, previous close and the
 *    intraday closes for every requested symbol in ONE request. This is the
 *    hot path and refreshes every poll.
 * 2. Descriptive fields (name, day range, 52-week range, volume, exchange)
 *    need the per-symbol `chart` endpoint. Those barely move intraday, so
 *    they are cached for ten minutes and only a few new symbols are enriched
 *    per request. Without that throttle a 30-symbol board fires 30 requests
 *    on first paint and earns an immediate 429 from the keyless endpoint.
 */

/**
 * The spark endpoint rejects more than 20 symbols per call with a bare
 * HTTP 400, so requests are chunked. Chunks are built from the sorted symbol
 * list, which keeps cache keys stable as the watchlist grows.
 */
const SPARK_CHUNK = 20;
const SPARK_CONCURRENCY = 2;
const SPARK_TTL_MS = 12_000;
const META_TTL_MS = 600_000;
/** How long a per-symbol price stays usable as a rate-limit fallback. */
const LAST_GOOD_TTL_MS = 900_000;
/**
 * Detail lookups per request. Sized so a cold ~35-symbol board fills in about
 * three poll cycles rather than the twelve that a smaller batch needed, while
 * still keeping well clear of the upstream's rate limit.
 */
const MAX_NEW_ENRICHMENTS = 12;
const ENRICH_CONCURRENCY = 4;

type SparkEntry = {
  symbol?: string;
  close?: (number | null)[];
  timestamp?: number[];
  /** Epoch seconds for the end of the session covered by this payload. */
  end?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fulldayPrice?: number;
  fulldayChange?: number;
  fulldayChangePercent?: number;
};

type ChartMeta = Record<string, unknown>;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.length ? v : fallback;

async function loadSpark(symbols: string[]): Promise<Record<string, SparkEntry>> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/spark` +
    `?symbols=${encodeURIComponent(symbols.join(","))}&range=1d&interval=5m`;
  const json = await getJson<Record<string, SparkEntry>>(url, { timeoutMs: 15_000 });
  if (!json || typeof json !== "object") throw new Error("malformed spark payload");

  // Mirror each symbol individually. The batch cache is keyed by the whole
  // symbol set, so adding one ticker would otherwise cold-start the board and
  // blank every price if that first request is rate-limited.
  for (const [symbol, entry] of Object.entries(json)) {
    if (entry && typeof entry === "object") put(`sparkone:${symbol}`, entry, LAST_GOOD_TTL_MS);
  }
  // Unknown symbols are simply omitted from the response object.
  return json;
}

async function loadMeta(symbol: string): Promise<ChartMeta> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1d&interval=1d`;
  const json = await getJson<{
    chart: { result?: { meta: ChartMeta }[]; error?: { description?: string } | null };
  }>(url, { timeoutMs: 12_000 });
  const meta = json.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(json.chart?.error?.description ?? `no metadata for ${symbol}`);
  return meta;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, 60);

  if (!symbols.length) {
    return NextResponse.json({ ok: false, data: [], fetchedAt: Date.now() });
  }

  const warnings: string[] = [];

  // --- hot path: batched requests for prices ------------------------------
  const sorted = [...symbols].sort();
  const chunks: string[][] = [];
  for (let i = 0; i < sorted.length; i += SPARK_CHUNK) {
    chunks.push(sorted.slice(i, i + SPARK_CHUNK));
  }

  const spark: Record<string, SparkEntry> = {};
  const chunkResults = await pool(chunks, SPARK_CONCURRENCY, (chunk) =>
    cached(`spark:${chunk.join(",")}`, SPARK_TTL_MS, () => loadSpark(chunk))
  );
  for (const r of chunkResults) {
    if (r.status === "fulfilled") Object.assign(spark, r.value.value);
  }
  const priceFailures = chunkResults.filter((r) => r.status === "rejected");
  if (priceFailures.length) {
    const reason = priceFailures[0].status === "rejected" ? priceFailures[0].reason : null;
    warnings.push(
      `prices: ${priceFailures.length}/${chunks.length} batches failed ` +
        `(${reason instanceof Error ? reason.message : String(reason)})`
    );
  }

  // --- cold path: descriptive metadata, throttled -------------------------
  const metaKey = (s: string) => `meta:${s}`;
  const stale = symbols.filter((s) => !isFresh(metaKey(s)));
  // Symbols with nothing cached at all go first: a blank row is worse than a
  // ten-minute-old 52-week high. The charted symbol outranks both, since its
  // day and 52-week ranges are displayed in full rather than as one cell.
  const priority = (req.nextUrl.searchParams.get("priority") ?? "").trim().toUpperCase();
  const rank = (s: string) =>
    (s === priority ? 0 : 2) + (peek<ChartMeta>(metaKey(s)) === undefined ? 0 : 1);
  const queue = [...stale].sort((a, b) => rank(a) - rank(b));
  const toEnrich = queue.slice(0, MAX_NEW_ENRICHMENTS);

  if (toEnrich.length) {
    const settled = await pool(toEnrich, ENRICH_CONCURRENCY, (s) =>
      cached(metaKey(s), META_TTL_MS, () => loadMeta(s))
    );
    const failed = settled.filter((r) => r.status === "rejected").length;
    if (failed) warnings.push(`${failed} symbol detail lookups deferred`);
  }
  const unresolved = queue
    .slice(toEnrich.length)
    .filter((s) => peek<ChartMeta>(metaKey(s)) === undefined).length;
  if (unresolved) warnings.push(`${unresolved} symbols pending detail`);

  let servedFromFallback = 0;

  const data: Quote[] = symbols.map((symbol) => {
    // Prefer this cycle's batch; fall back to the last good print per symbol.
    let s = spark[symbol];
    if (!s) {
      const lastGood = peek<SparkEntry>(`sparkone:${symbol}`);
      if (lastGood) {
        s = lastGood;
        servedFromFallback++;
      }
    }
    const m = peek<ChartMeta>(metaKey(symbol));

    const last = num(s?.fulldayPrice) ?? num(m?.regularMarketPrice);
    const prevClose =
      num(s?.chartPreviousClose) ?? num(s?.previousClose) ?? num(m?.chartPreviousClose);
    const change =
      last !== null && prevClose !== null ? last - prevClose : num(s?.fulldayChange);
    const changePct =
      last !== null && prevClose !== null && prevClose !== 0
        ? ((last - prevClose) / Math.abs(prevClose)) * 100
        : num(s?.fulldayChangePercent);

    const closes = (s?.close ?? []).filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    );

    return {
      symbol,
      name: SYMBOL_ALIASES[symbol] ?? str(m?.shortName, str(m?.longName, symbol)),
      last,
      change,
      changePct,
      prevClose,
      dayHigh: num(m?.regularMarketDayHigh),
      dayLow: num(m?.regularMarketDayLow),
      yearHigh: num(m?.fiftyTwoWeekHigh),
      yearLow: num(m?.fiftyTwoWeekLow),
      volume: num(m?.regularMarketVolume),
      currency: str(m?.currency, "USD"),
      exchange: str(m?.fullExchangeName, str(m?.exchangeName)),
      marketState: str(m?.marketState, "—"),
      asOf: num(s?.end) ?? num(m?.regularMarketTime),
      spark: closes.length > 120 ? closes.slice(-120) : closes,
      ...(last === null ? { error: "no price returned" } : {}),
    };
  });

  if (servedFromFallback) {
    warnings.push(`${servedFromFallback} prices served from last good print`);
  }

  const body: ApiEnvelope<Quote[]> = {
    ok: data.some((q) => q.last !== null),
    data,
    fetchedAt: Date.now(),
    stale: servedFromFallback > 0,
    warnings,
  };
  return NextResponse.json(body);
}
