export type Quote = {
  symbol: string;
  name: string;
  last: number | null;
  change: number | null;
  changePct: number | null;
  prevClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  currency: string;
  exchange: string;
  marketState: string;
  asOf: number | null;
  /** Intraday closes, used for the inline sparkline. */
  spark: number[];
  error?: string;
};

export type Candle = {
  t: number;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number | null;
};

export type Series = {
  symbol: string;
  name: string;
  range: string;
  interval: string;
  currency: string;
  prevClose: number | null;
  candles: Candle[];
};

export type NewsItem = {
  id: string;
  source: string;
  category: NewsCategory;
  title: string;
  url: string;
  summary: string;
  published: number | null;
  tickers: string[];
};

export type NewsCategory = "MKT" | "MACRO" | "CREDIT" | "RE" | "CO" | "WIRE";

export type NewsSource = {
  id: string;
  label: string;
  url: string;
  category: NewsCategory;
  enabledByDefault: boolean;
};

export type CurvePoint = { tenor: string; months: number; yield: number | null };

export type RatesBoard = {
  curveDate: string | null;
  curve: CurvePoint[];
  priorCurve: CurvePoint[];
  /** Spread and rate lines sourced from FRED's keyless CSV endpoint. */
  fred: FredLine[];
  futures: RateFuture[];
  notes: string[];
};

export type RateFuture = {
  symbol: string;
  name: string;
  last: number | null;
  prev: number | null;
  change: number | null;
};

export type FredLine = {
  id: string;
  label: string;
  unit: "pct" | "bps";
  last: number | null;
  prior: number | null;
  date: string | null;
  history: { d: string; v: number }[];
  error?: string;
};

export type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  country: string;
  event: string;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  description: string;
  importance: 1 | 2 | 3;
};

export type Article = {
  url: string;
  title: string | null;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
  excerpt: string | null;
  readingTimeMin: number | null;
  paragraphs: string[];
  truncated: boolean;
  error?: string;
};

export type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  fetchedAt: number;
  stale?: boolean;
  warnings?: string[];
};
