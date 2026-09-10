"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Panel from "./Panel";
import Sparkline from "./Sparkline";
import { useQuotes } from "./QuoteContext";
import { fmtChange, fmtPct, fmtPrice, fmtVolume, signClass } from "@/lib/format";
import type { Quote } from "@/lib/types";

type Props = {
  symbols: string[];
  selected: string;
  onSelect: (symbol: string) => void;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
};

type SortKey = "sym" | "last" | "chg" | "pct" | "vol";

export default function Watchlist({ symbols, selected, onSelect, onAdd, onRemove }: Props) {
  const book = useQuotes();
  // Rows follow the user's list; prices come from the shared batched poll.
  const feedData = useMemo(
    () => symbols.map((s) => book.get(s)).filter((q): q is Quote => q !== undefined),
    [symbols, book]
  );
  const feed = {
    data: feedData.length ? feedData : null,
    loading: book.loading,
    error: book.error,
    warnings: book.warnings,
    fetchedAt: book.fetchedAt,
    refresh: book.refresh,
  };
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "sym", desc: false });
  const [draft, setDraft] = useState("");

  // Track the previous print per symbol to flash the row on a tick.
  const prevPrices = useRef<Record<string, number>>({});
  const [ticks, setTicks] = useState<Record<string, "up" | "down">>({});

  useEffect(() => {
    if (!feed.data) return;
    const next: Record<string, "up" | "down"> = {};
    for (const q of feed.data) {
      const before = prevPrices.current[q.symbol];
      if (q.last !== null && before !== undefined && before !== q.last) {
        next[q.symbol] = q.last > before ? "up" : "down";
      }
      if (q.last !== null) prevPrices.current[q.symbol] = q.last;
    }
    if (Object.keys(next).length) {
      setTicks(next);
      const timer = setTimeout(() => setTicks({}), 700);
      return () => clearTimeout(timer);
    }
  }, [feed.data]);

  const rows = useMemo(() => {
    const quotes = feed.data ?? [];
    // Preserve the user's list order as the natural "sym" sort.
    const order = new Map(symbols.map((s, i) => [s, i]));
    const sorted = [...quotes];
    const dir = sort.desc ? -1 : 1;
    sorted.sort((a, b) => {
      switch (sort.key) {
        case "last":
          return dir * ((a.last ?? -Infinity) - (b.last ?? -Infinity));
        case "chg":
          return dir * ((a.change ?? -Infinity) - (b.change ?? -Infinity));
        case "pct":
          return dir * ((a.changePct ?? -Infinity) - (b.changePct ?? -Infinity));
        case "vol":
          return dir * ((a.volume ?? -Infinity) - (b.volume ?? -Infinity));
        default:
          return dir * ((order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0));
      }
    });
    return sorted;
  }, [feed.data, sort, symbols]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "sym" }));

  const header = (key: SortKey, label: string) => (
    <th onClick={() => toggleSort(key)} style={{ cursor: "pointer" }} title={`Sort by ${label}`}>
      {label}
      {sort.key === key ? (sort.desc ? "▾" : "▴") : ""}
    </th>
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = draft.trim().toUpperCase();
    if (sym) onAdd(sym);
    setDraft("");
  };

  const advancers = rows.filter((q) => (q.changePct ?? 0) > 0).length;
  const decliners = rows.filter((q) => (q.changePct ?? 0) < 0).length;

  return (
    <Panel
      title="QUOTE BOARD"
      subtitle={`${symbols.length} ISSUES`}
      fetchedAt={feed.fetchedAt}
      warnings={feed.warnings}
      error={feed.error}
      loading={feed.loading}
      onRefresh={feed.refresh}
      toolbar={
        <form className="add-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="add-symbol">
            Add symbol to quote board
          </label>
          <input
            id="add-symbol"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="add symbol, e.g. NVDA or ^GSPC"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="chip" type="submit">
            ADD
          </button>
        </form>
      }
      footLeft={
        <span>
          <span className="up">▲{advancers}</span> / <span className="down">▼{decliners}</span>
        </span>
      }
    >
      {feed.loading && !feed.data ? (
        <div className="empty">LOADING QUOTES…</div>
      ) : (
        <table className="grid-table">
          <thead>
            <tr>
              {header("sym", "SYM")}
              {header("last", "LAST")}
              {header("chg", "CHG")}
              {header("pct", "%CHG")}
              <th>1D</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr
                key={q.symbol}
                className={`${q.symbol === selected ? "sel " : ""}${
                  ticks[q.symbol] ? `tick-${ticks[q.symbol]}` : ""
                }`}
                onClick={() => onSelect(q.symbol)}
                title={
                  q.error
                    ? `${q.symbol}: ${q.error}`
                    : `${q.name}\n${q.exchange} · ${q.marketState}\n` +
                      `Day ${fmtPrice(q.dayLow, q.symbol)} – ${fmtPrice(q.dayHigh, q.symbol)}\n` +
                      `52wk ${fmtPrice(q.yearLow, q.symbol)} – ${fmtPrice(q.yearHigh, q.symbol)}\n` +
                      `Vol ${fmtVolume(q.volume)}`
                }
              >
                <td>
                  <span className="sym">{q.symbol}</span>
                </td>
                <td>{fmtPrice(q.last, q.symbol)}</td>
                <td className={signClass(q.change)}>{fmtChange(q.change, q.symbol)}</td>
                <td className={signClass(q.changePct)}>{fmtPct(q.changePct)}</td>
                <td>
                  <Sparkline values={q.spark} baseline={q.prevClose} />
                </td>
                <td>
                  <button
                    className="del-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(q.symbol);
                    }}
                    title={`Remove ${q.symbol}`}
                    aria-label={`Remove ${q.symbol}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
