"use client";

import { useMemo } from "react";
import Panel from "./Panel";
import PriceChart from "./PriceChart";
import { useQuotes } from "./QuoteContext";
import { fmtPct, fmtPrice, fmtVolume, signClass } from "@/lib/format";
import { useFeed } from "@/lib/useFeed";
import type { Series } from "@/lib/types";

const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "5y", "max"] as const;
export type Range = (typeof RANGES)[number];

type Props = {
  symbol: string;
  range: Range;
  onRangeChange: (r: Range) => void;
};

export default function ChartPanel({ symbol, range, onRangeChange }: Props) {
  const series = useFeed<Series>(
    `/api/chart?symbol=${encodeURIComponent(symbol)}&range=${range}`,
    range === "1d" ? 30_000 : 300_000
  );
  // The header quote comes from the shared book, not a second request.
  const book = useQuotes();
  const q = book.get(symbol);

  // Range percentage move, which for multi-year windows is the useful number.
  const rangeMove = useMemo(() => {
    const candles = series.data?.candles ?? [];
    if (candles.length < 2) return null;
    const first = candles[0].c;
    const last = candles[candles.length - 1].c;
    if (first === null || last === null || first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [series.data]);

  return (
    <Panel
      title="CHART"
      subtitle={series.data?.name ?? symbol}
      fetchedAt={series.fetchedAt}
      error={series.error}
      loading={series.loading}
      onRefresh={() => {
        series.refresh();
        book.refresh();
      }}
      headRight={
        <>
          {RANGES.map((r) => (
            <button
              key={r}
              className={`chip${r === range ? " on" : ""}`}
              onClick={() => onRangeChange(r)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </>
      }
      footLeft={
        <span>
          {series.data?.interval ? `INTERVAL ${series.data.interval.toUpperCase()}` : ""}
          {rangeMove !== null ? (
            <>
              {"  ·  "}
              {range.toUpperCase()} MOVE{" "}
              <span className={signClass(rangeMove)}>{fmtPct(rangeMove)}</span>
            </>
          ) : null}
        </span>
      }
    >
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%", minHeight: 0 }}>
        <div className="big-quote">
          <span className="bq-sym">{symbol}</span>
          <span className={`bq-last ${signClass(q?.change ?? null)}`}>
            {fmtPrice(q?.last ?? null, symbol)}
          </span>
          <span className={`bq-last ${signClass(q?.change ?? null)}`} style={{ fontSize: 12 }}>
            {q?.change !== undefined && q.change !== null
              ? `${q.change >= 0 ? "+" : ""}${fmtPrice(q.change, symbol)}`
              : "—"}{" "}
            {fmtPct(q?.changePct ?? null)}
          </span>
          <span className="bq-stat">
            DAY <b>{fmtPrice(q?.dayLow ?? null, symbol)}</b> – <b>{fmtPrice(q?.dayHigh ?? null, symbol)}</b>
          </span>
          <span className="bq-stat">
            52WK <b>{fmtPrice(q?.yearLow ?? null, symbol)}</b> –{" "}
            <b>{fmtPrice(q?.yearHigh ?? null, symbol)}</b>
          </span>
          <span className="bq-stat">
            VOL <b>{fmtVolume(q?.volume ?? null)}</b>
          </span>
          <span className="bq-stat">
            {q?.exchange ? `${q.exchange} · ${q.marketState}` : ""}
          </span>
        </div>

        {series.loading && !series.data ? (
          <div className="empty">LOADING {symbol}…</div>
        ) : series.data ? (
          <PriceChart
            candles={series.data.candles}
            prevClose={series.data.prevClose}
            symbol={symbol}
            intraday={range === "1d" || range === "5d"}
          />
        ) : (
          <div className="err">
            NO DATA FOR {symbol}
            {series.error ? `\n${series.error}` : ""}
          </div>
        )}
      </div>
    </Panel>
  );
}
