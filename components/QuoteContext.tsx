"use client";

import { createContext, useContext, useMemo } from "react";
import { useFeed } from "@/lib/useFeed";
import type { Quote } from "@/lib/types";

type QuoteBook = {
  get: (symbol: string) => Quote | undefined;
  quotes: Quote[];
  loading: boolean;
  error: string | null;
  warnings: string[];
  fetchedAt: number | null;
  refresh: () => void;
};

const QuoteCtx = createContext<QuoteBook | null>(null);

/**
 * Single source of prices for the whole terminal.
 *
 * The tape, the quote board and the chart header all want the same symbols.
 * Polling them independently tripled the request count against a keyless,
 * IP-rate-limited upstream, so every consumer reads from one batched poll.
 */
export function QuoteProvider({
  symbols,
  priority,
  intervalMs = 15_000,
  children,
}: {
  symbols: string[];
  /** Symbol whose descriptive detail should be fetched first. */
  priority?: string;
  intervalMs?: number;
  children: React.ReactNode;
}) {
  // Sorted and de-duplicated so an unchanged set does not restart the poll.
  const key = useMemo(
    () => Array.from(new Set(symbols.filter(Boolean).map((s) => s.toUpperCase()))).sort().join(","),
    [symbols]
  );

  const feed = useFeed<Quote[]>(
    key
      ? `/api/quote?symbols=${encodeURIComponent(key)}` +
        (priority ? `&priority=${encodeURIComponent(priority.toUpperCase())}` : "")
      : null,
    intervalMs
  );

  const book = useMemo<QuoteBook>(() => {
    const map = new Map((feed.data ?? []).map((q) => [q.symbol, q]));
    return {
      get: (symbol: string) => map.get(symbol.toUpperCase()),
      quotes: feed.data ?? [],
      loading: feed.loading,
      error: feed.error,
      warnings: feed.warnings,
      fetchedAt: feed.fetchedAt,
      refresh: feed.refresh,
    };
  }, [feed.data, feed.loading, feed.error, feed.warnings, feed.fetchedAt, feed.refresh]);

  return <QuoteCtx.Provider value={book}>{children}</QuoteCtx.Provider>;
}

export function useQuotes(): QuoteBook {
  const ctx = useContext(QuoteCtx);
  if (!ctx) throw new Error("useQuotes must be used inside a QuoteProvider");
  return ctx;
}
