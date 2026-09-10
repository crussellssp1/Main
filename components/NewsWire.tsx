"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Panel from "./Panel";
import ArticleReader from "./ArticleReader";
import { fmtAge, fmtTimeOnly } from "@/lib/format";
import { CATEGORY_LABEL, NEWS_SOURCES } from "@/lib/sources";
import { useFeed } from "@/lib/useFeed";
import type { NewsCategory, NewsItem } from "@/lib/types";

type Props = {
  sourceIds: string[];
  onSourceIdsChange: (ids: string[]) => void;
  onSymbolPick: (symbol: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
};

const CATEGORIES: (NewsCategory | "ALL")[] = ["ALL", "WIRE", "MKT", "MACRO", "CREDIT", "CO", "RE"];

export default function NewsWire({
  sourceIds,
  onSourceIdsChange,
  onSymbolPick,
  query,
  onQueryChange,
}: Props) {
  const url = `/api/news?sources=${encodeURIComponent(sourceIds.join(","))}&limit=300`;
  const feed = useFeed<NewsItem[]>(url, 60_000);
  const [category, setCategory] = useState<NewsCategory | "ALL">("ALL");
  const [showSources, setShowSources] = useState(false);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const all = feed.data ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((it) => {
      if (category !== "ALL" && it.category !== category) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.summary.toLowerCase().includes(q) ||
        it.tickers.some((t) => t.toLowerCase() === q)
      );
    });
  }, [feed.data, category, query]);

  // Keep the highlighted headline in range as the wire refreshes.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j" || e.key === "ArrowDown") {
        setCursor((c) => Math.min(items.length - 1, c + 1));
        e.preventDefault();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        setCursor((c) => Math.max(0, c - 1));
        e.preventDefault();
      } else if (e.key === "Enter" && items[cursor]) {
        setOpenUrl(items[cursor].url);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, cursor]);

  useEffect(() => {
    bodyRef.current
      ?.querySelector(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const toggleSource = (id: string) => {
    onSourceIdsChange(
      sourceIds.includes(id) ? sourceIds.filter((s) => s !== id) : [...sourceIds, id]
    );
  };

  return (
    <Panel
      relative
      title="NEWS WIRE"
      subtitle={`${items.length} STORIES · ${sourceIds.length} FEEDS`}
      fetchedAt={feed.fetchedAt}
      warnings={feed.warnings}
      error={feed.error}
      loading={feed.loading}
      onRefresh={feed.refresh}
      headRight={
        <>
          <input
            className="cmd-input"
            style={{ width: 130, height: 17, letterSpacing: 0, textTransform: "none" }}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="filter headlines"
            spellCheck={false}
            aria-label="Filter headlines"
          />
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip${c === category ? " on" : ""}`}
              onClick={() => setCategory(c)}
              title={CATEGORY_LABEL[c]}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
          <button
            className={`chip${showSources ? " on" : ""}`}
            onClick={() => setShowSources((s) => !s)}
          >
            FEEDS
          </button>
        </>
      }
      toolbar={
        showSources ? (
          <div className="chip-row">
            {NEWS_SOURCES.map((s) => (
              <button
                key={s.id}
                className={`chip${sourceIds.includes(s.id) ? " on" : ""}`}
                onClick={() => toggleSource(s.id)}
                title={s.url}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
      footLeft={<span>J/K MOVE · ENTER READ · CLICK HEADLINE TO OPEN</span>}
    >
      <div className="wire" ref={bodyRef}>
        {feed.loading && !feed.data ? (
          <div className="empty">CONNECTING TO WIRES…</div>
        ) : items.length === 0 ? (
          <div className="empty">NO STORIES MATCH THE CURRENT FILTER</div>
        ) : (
          items.map((it, idx) => (
            <div
              key={it.id}
              data-idx={idx}
              className={`wire-row${idx === cursor ? " sel" : ""}`}
              onClick={() => {
                setCursor(idx);
                setOpenUrl(it.url);
              }}
              title={it.summary || it.title}
            >
              <span className="wire-age" title={fmtTimeOnly(it.published)}>
                {fmtAge(it.published)}
              </span>
              <span className="wire-src">{it.source}</span>
              <span className="wire-headline">
                {it.title}
                {it.tickers.length ? (
                  <span className="wire-tickers">
                    {it.tickers.map((t) => (
                      <button
                        key={t}
                        className="wire-ticker"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSymbolPick(t);
                        }}
                        title={`Load ${t} in the chart`}
                      >
                        {t}
                      </button>
                    ))}
                  </span>
                ) : null}
                {it.summary ? <span className="wire-summary">{it.summary}</span> : null}
              </span>
            </div>
          ))
        )}
      </div>

      {openUrl ? <ArticleReader url={openUrl} onClose={() => setOpenUrl(null)} /> : null}
    </Panel>
  );
}
