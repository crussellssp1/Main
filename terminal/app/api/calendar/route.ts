import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getJson, settle } from "@/lib/http";
import { clean } from "@/lib/text";
import type { ApiEnvelope, CalendarEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

type NasdaqCalendar = {
  data?: {
    asOf?: string;
    rows?:
      | {
          gmt?: string;
          country?: string;
          eventName?: string;
          actual?: string;
          consensus?: string;
          previous?: string;
          description?: string;
        }[]
      | null;
  } | null;
};

/**
 * Releases that move rates and credit. Anything matching tier 1 is flagged
 * high importance in the panel, tier 2 medium, everything else low.
 */
const TIER_1 = [
  /\bFOMC\b/i,
  /interest rate decision/i,
  /\bCPI\b/i,
  /consumer price/i,
  /\bPCE\b/i,
  /nonfarm payroll/i,
  /unemployment rate/i,
  /\bGDP\b/i,
  /\bPPI\b/i,
  /fed chair/i,
  /powell/i,
  /jobless claims/i,
];

const TIER_2 = [
  /\bISM\b/i,
  /\bPMI\b/i,
  /retail sales/i,
  /housing starts/i,
  /building permits/i,
  /existing home sales/i,
  /new home sales/i,
  /case[- ]shiller/i,
  /durable goods/i,
  /consumer confidence/i,
  /consumer sentiment/i,
  /industrial production/i,
  /treasury (?:auction|refunding)/i,
  /beige book/i,
  /trade balance/i,
];

function importance(event: string): 1 | 2 | 3 {
  if (TIER_1.some((re) => re.test(event))) return 3;
  if (TIER_2.some((re) => re.test(event))) return 2;
  return 1;
}

/**
 * Empty cells arrive as "", "-", "&nbsp;" or a literal non-breaking space, so
 * the value is decoded before the emptiness test. Skipping that put a raw
 * "&nbsp;" in the Actual column.
 */
const blank = (v: string | undefined): string | null => {
  const t = clean(v ?? "", 40)
    .replace(/ /g, " ")
    .trim();
  return t === "" || t === "-" || t === "--" ? null : t;
};

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function loadDay(date: string): Promise<CalendarEvent[]> {
  const json = await getJson<NasdaqCalendar>(
    `https://api.nasdaq.com/api/calendar/economicevents?date=${date}`,
    { timeoutMs: 15_000 }
  );
  const rows = json.data?.rows ?? [];
  const isFuture = date > isoDay(0);

  return rows
    .map((row, idx) => {
      const event = clean(row.eventName ?? "", 160);
      if (!event) return null;
      const item: CalendarEvent = {
        id: `${date}:${idx}:${event.slice(0, 40)}`,
        date,
        time: blank(row.gmt) ?? "",
        country: clean(row.country ?? "", 40) || "—",
        event,
        // A release scheduled for a future date cannot have printed yet. The
        // upstream feed sometimes copies today's actuals onto tomorrow's rows,
        // and showing those as real prints would be plainly wrong.
        actual: isFuture ? null : blank(row.actual),
        consensus: blank(row.consensus),
        previous: blank(row.previous),
        description: clean(row.description ?? "", 900),
        importance: importance(event),
      };
      return item;
    })
    .filter((v): v is CalendarEvent => v !== null);
}

/**
 * The upstream feed occasionally returns one day's schedule again for the next
 * day. Drop a row when the identical release (same time, country, name,
 * consensus and previous) already appeared on the immediately preceding day.
 * Genuinely recurring releases sit a week apart and carry different values, so
 * they survive.
 */
function dropMirroredDays(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Map<string, string>(); // signature -> earliest date seen
  const sig = (e: CalendarEvent) =>
    [e.time, e.country, e.event, e.consensus ?? "", e.previous ?? ""].join("|");

  const prevDay = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  return events.filter((e) => {
    const key = sig(e);
    const first = seen.get(key);
    if (first !== undefined && first === prevDay(e.date)) return false;
    if (first === undefined) seen.set(key, e.date);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const back = Math.min(Math.max(Number(p.get("back") ?? 1) || 1, 0), 7);
  const ahead = Math.min(Math.max(Number(p.get("ahead") ?? 6) || 6, 1), 21);

  const days: string[] = [];
  for (let i = -back; i <= ahead; i++) days.push(isoDay(i));

  const results = await settle(
    days.map((date) => ({
      key: date,
      // Past days are settled data; future days can still gain a consensus.
      run: async () =>
        (await cached(`cal:${date}`, date < isoDay(0) ? 3_600_000 : 600_000, () =>
          loadDay(date)
        )).value,
    }))
  );

  const raw = results.flatMap((r) => r.value ?? []);
  raw.sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  );
  const events = dropMirroredDays(raw);

  const body: ApiEnvelope<CalendarEvent[]> = {
    ok: events.length > 0,
    data: events,
    fetchedAt: Date.now(),
    warnings: results.filter((r) => r.error).map((r) => `${r.key}: ${r.error}`),
  };
  return NextResponse.json(body);
}
