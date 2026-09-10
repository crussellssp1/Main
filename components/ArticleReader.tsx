"use client";

import { useEffect } from "react";
import { useFeed } from "@/lib/useFeed";
import type { Article } from "@/lib/types";

type Props = {
  url: string;
  onClose: () => void;
};

export default function ArticleReader({ url, onClose }: Props) {
  // Article text does not change while it is open, so poll effectively never.
  const feed = useFeed<Article>(`/api/article?url=${encodeURIComponent(url)}`, 3_600_000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const a = feed.data;
  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  const failed = Boolean(a?.error) || (a !== null && a?.paragraphs.length === 0);

  return (
    <div className="reader" role="dialog" aria-label="Article reader">
      <header className="reader-head">
        <span className="panel-title">ARTICLE</span>
        <span className="panel-sub">{a?.siteName ?? host}</span>
        <span className="panel-head-right">
          <a
            className="chip"
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: "none" }}
          >
            OPEN SOURCE ↗
          </a>
          <button className="chip on" onClick={onClose}>
            CLOSE · ESC
          </button>
        </span>
      </header>

      <div className="reader-body">
        {feed.loading && !a ? (
          <div className="empty">EXTRACTING ARTICLE TEXT…</div>
        ) : (
          <>
            <h1 className="reader-title">{a?.title ?? host}</h1>
            <div className="reader-meta">
              {[
                a?.byline,
                a?.publishedTime
                  ? new Date(a.publishedTime).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })
                  : null,
                a?.readingTimeMin ? `${a.readingTimeMin} MIN READ` : null,
                host.toUpperCase(),
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </div>

            {failed ? (
              <div className="reader-note">
                This publisher blocked server-side extraction, or the page is behind a
                paywall or consent wall. Nothing was retrieved beyond the headline. Use
                OPEN SOURCE above to read it in a browser tab where your own session
                cookies apply.
                {a?.error ? `\n\nReason: ${a.error}` : ""}
              </div>
            ) : (
              a?.paragraphs.map((p, i) => <p key={i}>{p}</p>)
            )}

            {a?.truncated ? (
              <div className="reader-note">
                Article truncated at 120 paragraphs. Open the source for the remainder.
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
