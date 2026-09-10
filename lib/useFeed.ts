"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiEnvelope } from "./types";

export type FeedState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  warnings: string[];
  fetchedAt: number | null;
  refresh: () => void;
};

/**
 * Polls a terminal endpoint on an interval, keeps the last good payload on
 * screen through a failure, and pauses while the tab is hidden so a terminal
 * left open overnight does not hammer the free upstreams.
 */
export function useFeed<T>(
  url: string | null,
  intervalMs: number,
  opts: { pauseWhenHidden?: boolean } = {}
): FeedState<T> {
  const { pauseWhenHidden = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      inflight.current?.abort();
      const ac = new AbortController();
      inflight.current = ac;
      try {
        const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
        const json = (await res.json()) as ApiEnvelope<T>;
        if (cancelled) return;
        // A falsy `ok` with a payload still beats an empty panel.
        if (json.data !== null && json.data !== undefined) setData(json.data);
        setWarnings(json.warnings ?? []);
        setFetchedAt(json.fetchedAt ?? Date.now());
        setError(json.ok || json.data ? null : "upstream returned no data");
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => {
      if (pauseWhenHidden && typeof document !== "undefined" && document.hidden) return;
      void load();
    }, intervalMs);

    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      inflight.current?.abort();
    };
  }, [url, intervalMs, nonce, pauseWhenHidden]);

  return { data, loading, error, warnings, fetchedAt, refresh };
}

/** localStorage-backed state so the watchlist and layout survive a reload. */
export function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Corrupt or unavailable storage: fall back to the default silently.
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // Private-mode storage failures should not break the UI.
      }
    },
    [key]
  );

  void hydrated;
  return [value, update];
}
