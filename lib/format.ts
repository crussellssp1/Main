import { YIELD_SYMBOLS } from "./sources";

const DASH = "—";

/** Price precision that keeps indices, FX crosses and pennies all readable. */
export function fmtPrice(v: number | null, symbol = ""): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  if (YIELD_SYMBOLS.has(symbol)) return `${v.toFixed(3)}%`;
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtChange(v: number | null, symbol = ""): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  const sign = v > 0 ? "+" : v < 0 ? "-" : " ";
  return `${sign}${fmtPrice(Math.abs(v), symbol)}`;
}

export function fmtPct(v: number | null, digits = 2): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  const sign = v > 0 ? "+" : v < 0 ? "-" : " ";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

/** Basis points, for curve moves and OAS changes. */
export function fmtBps(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  const sign = v > 0 ? "+" : v < 0 ? "-" : " ";
  return `${sign}${Math.abs(v).toFixed(0)}bp`;
}

export function fmtVolume(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v === 0) return DASH;
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (Math.abs(v) >= size) return `${(v / size).toFixed(2)}${suffix}`;
  }
  return v.toFixed(0);
}

export function signClass(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v === 0) return "flat";
  return v > 0 ? "up" : "down";
}

const ET = "America/New_York";

export function fmtClock(d: Date, tz = ET): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
}

export function fmtDateTimeET(ms: number | null): string {
  if (ms === null) return DASH;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ET,
  }).format(new Date(ms));
}

/** Wire-style relative stamp: 4m, 2h, 3d. */
export function fmtAge(ms: number | null): string {
  if (ms === null) return DASH;
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function fmtTimeOnly(ms: number | null): string {
  if (ms === null) return DASH;
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ET,
  }).format(new Date(ms));
}

/**
 * The calendar feed publishes times as GMT HH:MM against a given date.
 * Traders here work in Eastern, so convert.
 */
export function gmtToEt(date: string, hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm || DASH;
  const ms = Date.parse(`${date}T${hhmm}:00Z`);
  if (!Number.isFinite(ms)) return hhmm;
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ET,
  }).format(new Date(ms));
}

export function fmtDayLabel(iso: string): string {
  const ms = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(ms)) return iso;
  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  )
    .toISOString()
    .slice(0, 10);
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(ms))
    .toUpperCase();
  if (iso === todayIso) return `${label}  ·  TODAY`;
  return label;
}
