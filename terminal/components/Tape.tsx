"use client";

import { useQuotes } from "./QuoteContext";
import { fmtPct, fmtPrice, signClass } from "@/lib/format";
import { TAPE_SYMBOLS } from "@/lib/sources";
import type { Quote } from "@/lib/types";

export default function Tape({ onSelect }: { onSelect: (symbol: string) => void }) {
  const book = useQuotes();
  const quotes = TAPE_SYMBOLS.map((s) => book.get(s)).filter(
    (q): q is Quote => q !== undefined && q.last !== null
  );

  if (!quotes.length) {
    return (
      <div className="tape">
        <span className="tape-item">
          <span className="t-sym">TAPE</span>
          <span className="flat">{book.error ? "FEED UNAVAILABLE" : "CONNECTING…"}</span>
        </span>
      </div>
    );
  }

  const item = (q: Quote, key: string) => (
    <button className="tape-item" key={key} onClick={() => onSelect(q.symbol)} title={q.name}>
      <span className="t-sym">{q.name || q.symbol}</span>
      <span className="t-last">{fmtPrice(q.last, q.symbol)}</span>
      <span className={signClass(q.changePct)}>{fmtPct(q.changePct)}</span>
    </button>
  );

  return (
    <div className="tape">
      {/* Duplicated once so the -50% marquee translation loops seamlessly. */}
      <div className="tape-track">
        {quotes.map((q) => item(q, `a-${q.symbol}`))}
        {quotes.map((q) => item(q, `b-${q.symbol}`))}
      </div>
    </div>
  );
}
