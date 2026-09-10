import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { get, settle } from "@/lib/http";
import type {
  ApiEnvelope,
  CurvePoint,
  FredLine,
  RateFuture,
  RatesBoard,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Treasury publishes the full daily par yield curve as keyless CSV, one file
 * per year, newest row first.
 */
const TREASURY_CSV = (year: number) =>
  `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/` +
  `daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve` +
  `&field_tdr_date_value=${year}&page&_format=csv`;

/**
 * FRED's graph CSV endpoint needs no API key. Spread series are OAS in percent.
 */
const FRED_SERIES: { id: string; label: string; unit: FredLine["unit"] }[] = [
  { id: "BAMLH0A0HYM2", label: "US HY OAS", unit: "pct" },
  { id: "BAMLH0A3HYC", label: "US CCC OAS", unit: "pct" },
  { id: "BAMLC0A4CBBB", label: "US BBB OAS", unit: "pct" },
  { id: "BAMLC0A0CM", label: "US IG OAS", unit: "pct" },
  { id: "BAMLHE00EHYIOAS", label: "EUR HY OAS", unit: "pct" },
  { id: "SOFR", label: "SOFR O/N", unit: "pct" },
  { id: "EFFR", label: "FED FUNDS EFF", unit: "pct" },
  { id: "DGS2", label: "UST 2Y", unit: "pct" },
  { id: "DGS10", label: "UST 10Y", unit: "pct" },
  { id: "T10Y2Y", label: "10Y-2Y SLOPE", unit: "pct" },
  { id: "T10Y3M", label: "10Y-3M SLOPE", unit: "pct" },
  { id: "MORTGAGE30US", label: "30Y MORTGAGE", unit: "pct" },
];

/** Rate and curve futures, priced off the same Yahoo endpoint as the tape. */
const RATE_FUTURES = ["ZQ=F", "SR3=F", "ZT=F", "ZF=F", "ZN=F", "ZB=F"];

const TENORS: { header: string; tenor: string; months: number }[] = [
  { header: "1 Mo", tenor: "1M", months: 1 },
  { header: "2 Mo", tenor: "2M", months: 2 },
  { header: "3 Mo", tenor: "3M", months: 3 },
  { header: "4 Mo", tenor: "4M", months: 4 },
  { header: "6 Mo", tenor: "6M", months: 6 },
  { header: "1 Yr", tenor: "1Y", months: 12 },
  { header: "2 Yr", tenor: "2Y", months: 24 },
  { header: "3 Yr", tenor: "3Y", months: 36 },
  { header: "5 Yr", tenor: "5Y", months: 60 },
  { header: "7 Yr", tenor: "7Y", months: 84 },
  { header: "10 Yr", tenor: "10Y", months: 120 },
  { header: "20 Yr", tenor: "20Y", months: 240 },
  { header: "30 Yr", tenor: "30Y", months: 360 },
];

/** CSV split that respects double-quoted headers such as "1.5 Month". */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

type CurveResult = { date: string | null; curve: CurvePoint[]; prior: CurvePoint[] };

async function loadCurve(): Promise<CurveResult> {
  const year = new Date().getFullYear();
  let csv = await get(TREASURY_CSV(year), { timeoutMs: 20_000, accept: "text/csv" });
  let lines = csv.trim().split(/\r?\n/);
  // Early January the current-year file can exist with only a header row.
  if (lines.length < 3) {
    csv = await get(TREASURY_CSV(year - 1), { timeoutMs: 20_000, accept: "text/csv" });
    lines = csv.trim().split(/\r?\n/);
  }
  if (lines.length < 2) throw new Error("empty treasury curve file");

  const headers = splitCsvLine(lines[0]);
  const rowToCurve = (line: string): CurvePoint[] => {
    const cells = splitCsvLine(line);
    return TENORS.map(({ header, tenor, months }) => {
      const idx = headers.indexOf(header);
      const raw = idx >= 0 ? cells[idx] : "";
      const v = raw === "" || raw === "N/A" ? NaN : Number(raw);
      return { tenor, months, yield: Number.isFinite(v) ? v : null };
    });
  };

  return {
    date: splitCsvLine(lines[1])[headers.indexOf("Date")] ?? null,
    curve: rowToCurve(lines[1]),
    prior: lines.length > 2 ? rowToCurve(lines[2]) : [],
  };
}

async function loadFred(series: (typeof FRED_SERIES)[number]): Promise<FredLine> {
  // Two years of history is enough for the panel's sparkline.
  const start = new Date();
  start.setFullYear(start.getFullYear() - 2);
  const url =
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series.id}` +
    `&cosd=${start.toISOString().slice(0, 10)}`;
  const csv = await get(url, { timeoutMs: 20_000, accept: "text/csv" });

  const rows = csv.trim().split(/\r?\n/).slice(1);
  const history: { d: string; v: number }[] = [];
  for (const row of rows) {
    const [d, raw] = row.split(",");
    // FRED writes "." for no-observation days (holidays, pre-start), and a
    // truncated row can leave the value empty. Number("") is 0, so an explicit
    // emptiness check is required or a missing print becomes a fake 0.00%.
    const cell = (raw ?? "").trim();
    if (!d || cell === "") continue;
    const v = Number(cell);
    if (!Number.isFinite(v)) continue;
    history.push({ d, v });
  }
  if (!history.length) throw new Error(`no observations for ${series.id}`);

  const lastPoint = history[history.length - 1];
  const priorPoint = history.length > 1 ? history[history.length - 2] : null;
  return {
    id: series.id,
    label: series.label,
    unit: series.unit,
    last: lastPoint.v,
    prior: priorPoint?.v ?? null,
    date: lastPoint.d,
    history: history.slice(-260),
  };
}

async function loadFuture(symbol: string): Promise<RateFuture> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=1d&interval=1d`;
  const json = JSON.parse(await get(url, { timeoutMs: 10_000 })) as {
    chart: { result?: { meta: Record<string, unknown> }[] };
  };
  const m = json.chart?.result?.[0]?.meta;
  if (!m) throw new Error(`no data for ${symbol}`);

  const last = typeof m.regularMarketPrice === "number" ? m.regularMarketPrice : null;
  const prev = typeof m.chartPreviousClose === "number" ? m.chartPreviousClose : null;
  return {
    symbol,
    // Yahoo appends the contract month, which is worth keeping on hover.
    name: typeof m.shortName === "string" ? m.shortName : symbol,
    last,
    prev,
    change: last !== null && prev !== null ? last - prev : null,
  };
}

export async function GET() {
  const notes: string[] = [];

  const [curveRes, fredRes, futuresRes] = await Promise.all([
    settle([
      { key: "curve", run: async () => (await cached("rates:curve", 900_000, loadCurve)).value },
    ]),
    settle(
      FRED_SERIES.map((s) => ({
        key: s.id,
        run: async () => (await cached(`fred:${s.id}`, 1_800_000, () => loadFred(s))).value,
      }))
    ),
    // One contract per task: a single dead or rolled contract must not blank
    // the whole futures section.
    settle(
      RATE_FUTURES.map((symbol) => ({
        key: symbol,
        run: async () =>
          (await cached(`fut:${symbol}`, 60_000, () => loadFuture(symbol))).value,
      }))
    ),
  ]);

  const curve = curveRes[0]?.value;
  if (!curve) notes.push(`treasury curve: ${curveRes[0]?.error ?? "unavailable"}`);

  const fred: FredLine[] = [];
  for (const r of fredRes) {
    if (r.value) fred.push(r.value);
    else {
      const spec = FRED_SERIES.find((s) => s.id === r.key)!;
      fred.push({
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        last: null,
        prior: null,
        date: null,
        history: [],
        error: r.error ?? "unavailable",
      });
    }
  }
  const fredFailures = fred.filter((f) => f.error).length;
  if (fredFailures === FRED_SERIES.length) {
    notes.push(
      "FRED unreachable from this host: spread and policy-rate rows are blank. " +
        "Curve and futures are unaffected."
    );
  } else if (fredFailures) {
    notes.push(`${fredFailures} FRED series unavailable`);
  }

  const futuresFailures = futuresRes.filter((r) => r.error).length;
  if (futuresFailures) notes.push(`${futuresFailures} rate futures unavailable`);

  const body: ApiEnvelope<RatesBoard> = {
    ok: Boolean(curve) || fredFailures < FRED_SERIES.length,
    data: {
      curveDate: curve?.date ?? null,
      curve: curve?.curve ?? [],
      priorCurve: curve?.prior ?? [],
      fred,
      futures: futuresRes
        .map((r) => r.value)
        .filter((f): f is RateFuture => f !== undefined),
      notes,
    },
    fetchedAt: Date.now(),
    warnings: notes,
  };
  return NextResponse.json(body);
}
