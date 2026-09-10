"use client";

import { useMemo, useState } from "react";
import Panel from "./Panel";
import { fmtDayLabel, gmtToEt } from "@/lib/format";
import { useFeed } from "@/lib/useFeed";
import type { CalendarEvent } from "@/lib/types";

/** Pull the leading number out of "3.2%" or "-0.4%" so beats can be coloured. */
function parseValue(v: string | null): number | null {
  if (!v) return null;
  const m = v.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function surpriseClass(actual: string | null, consensus: string | null): string {
  const a = parseValue(actual);
  const c = parseValue(consensus);
  if (a === null || c === null || a === c) return "";
  return a > c ? "beat" : "miss";
}

export default function CalendarPanel() {
  const [usOnly, setUsOnly] = useState(true);
  const [minImportance, setMinImportance] = useState<1 | 2 | 3>(2);
  const feed = useFeed<CalendarEvent[]>("/api/calendar?back=1&ahead=7", 600_000);

  const grouped = useMemo(() => {
    const events = (feed.data ?? []).filter((e) => {
      if (usOnly && !/^united states$|^usa?$/i.test(e.country.trim())) return false;
      return e.importance >= minImportance;
    });
    const byDay = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = byDay.get(e.date) ?? [];
      list.push(e);
      byDay.set(e.date, list);
    }
    return Array.from(byDay.entries());
  }, [feed.data, usOnly, minImportance]);

  const total = grouped.reduce((n, [, list]) => n + list.length, 0);

  return (
    <Panel
      title="ECONOMIC CALENDAR"
      subtitle={`${total} RELEASES · TIMES ET`}
      fetchedAt={feed.fetchedAt}
      warnings={feed.warnings}
      error={feed.error}
      loading={feed.loading}
      onRefresh={feed.refresh}
      headRight={
        <>
          <button className={`chip${usOnly ? " on" : ""}`} onClick={() => setUsOnly((v) => !v)}>
            US ONLY
          </button>
          {([3, 2, 1] as const).map((lvl) => (
            <button
              key={lvl}
              className={`chip${minImportance === lvl ? " on" : ""}`}
              onClick={() => setMinImportance(lvl)}
              title={lvl === 3 ? "Tier 1 only" : lvl === 2 ? "Tier 1 and 2" : "Everything"}
            >
              {lvl === 3 ? "TIER 1" : lvl === 2 ? "TIER 1-2" : "ALL"}
            </button>
          ))}
        </>
      }
      footLeft={<span>HOVER A RELEASE FOR THE FULL DESCRIPTION</span>}
    >
      {feed.loading && !feed.data ? (
        <div className="empty">LOADING CALENDAR…</div>
      ) : total === 0 ? (
        <div className="empty">NO RELEASES MATCH THE CURRENT FILTER</div>
      ) : (
        grouped.map(([day, list]) => (
          <div key={day}>
            <div className="cal-day">{fmtDayLabel(day)}</div>
            <table className="grid-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>TIME</th>
                  <th style={{ textAlign: "left" }}>RELEASE</th>
                  <th style={{ width: 58 }}>ACTUAL</th>
                  <th style={{ width: 54 }}>CONS</th>
                  <th style={{ width: 54 }}>PRIOR</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr
                    key={e.id}
                    className={e.importance === 3 ? "hi" : ""}
                    title={`${e.country} · ${e.event}\n${gmtToEt(e.date, e.time)} ET (${e.time} GMT)\n\n${
                      e.description || "No description provided."
                    }`}
                  >
                    <td style={{ textAlign: "left" }}>{gmtToEt(e.date, e.time)}</td>
                    <td style={{ textAlign: "left" }} className="cal-event">
                      <span className={`imp imp-${e.importance}`} />
                      {usOnly ? "" : `${e.country.slice(0, 12).toUpperCase()} · `}
                      {e.event}
                    </td>
                    <td className={surpriseClass(e.actual, e.consensus)}>{e.actual ?? "—"}</td>
                    <td className="flat">{e.consensus ?? "—"}</td>
                    <td className="flat">{e.previous ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </Panel>
  );
}
