import { NextRequest, NextResponse } from "next/server";
import { envelope, TTL } from "@/lib/apiResponse";
import { cached } from "@/lib/cache";
import { getJson } from "@/lib/http";
import { SYMBOL_ALIASES } from "@/lib/sources";
import type { ApiEnvelope, Candle, Series } from "@/lib/types";

export const dynamic = "force-dynamic";
// Single upstream request, but cold starts can be slow.
// The default serverless ceiling of 10s is not enough on a cold start.
export const maxDuration = 20;

/** Interval Yahoo accepts for each range, and how long the result stays fresh. */
const RANGE_SPEC: Record<string, { interval: string; ttlMs: number }> = {
  "1d": { interval: "5m", ttlMs: 30_000 },
  "5d": { interval: "15m", ttlMs: 60_000 },
  "1mo": { interval: "1d", ttlMs: 300_000 },
  "3mo": { interval: "1d", ttlMs: 300_000 },
  "6mo": { interval: "1d", ttlMs: 600_000 },
  ytd: { interval: "1d", ttlMs: 600_000 },
  "1y": { interval: "1d", ttlMs: 900_000 },
  "5y": { interval: "1wk", ttlMs: 3_600_000 },
  max: { interval: "1mo", ttlMs: 3_600_000 },
};

type YahooChart = {
  chart: {
    result?: {
      meta: Record<string, unknown>;
      timestamp?: number[];
      indicators?: {
        quote?: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: { description?: string } | null;
  };
};

const at = (arr: (number | null)[] | undefined, i: number): number | null => {
  const v = arr?.[i];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

async function loadSeries(symbol: string, range: string, interval: string): Promise<Series> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;
  const json = await getJson<YahooChart>(url, { timeoutMs: 15_000 });
  const res = json.chart?.result?.[0];
  if (!res) {
    throw new Error(json.chart?.error?.description ?? `no data for ${symbol}`);
  }
  const q = res.indicators?.quote?.[0];
  const ts = res.timestamp ?? [];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = at(q?.close, i);
    if (c === null) continue; // Yahoo pads gaps with nulls; drop them.
    candles.push({
      t: ts[i] * 1000,
      o: at(q?.open, i),
      h: at(q?.high, i),
      l: at(q?.low, i),
      c,
      v: at(q?.volume, i),
    });
  }
  const meta = res.meta;
  return {
    symbol,
    name:
      SYMBOL_ALIASES[symbol] ??
      (typeof meta.shortName === "string" ? meta.shortName : symbol),
    range,
    interval,
    currency: typeof meta.currency === "string" ? meta.currency : "USD",
    prevClose:
      typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : null,
    candles,
  };
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbol = (p.get("symbol") ?? "").trim().toUpperCase();
  const range = p.get("range") ?? "1y";
  const spec = RANGE_SPEC[range];

  if (!symbol || !spec) {
    return NextResponse.json(
      { ok: false, data: null, fetchedAt: Date.now(), warnings: ["bad symbol or range"] },
      { status: 400 }
    );
  }

  try {
    const { value, stale } = await cached(
      `chart:${symbol}:${range}`,
      spec.ttlMs,
      () => loadSeries(symbol, range, spec.interval)
    );
    const body: ApiEnvelope<Series> = {
      ok: true,
      data: value,
      fetchedAt: Date.now(),
      stale,
    };
    return envelope(body, { sMaxAge: TTL.chart });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        fetchedAt: Date.now(),
        warnings: [String(err instanceof Error ? err.message : err)],
      },
      { status: 502 }
    );
  }
}
