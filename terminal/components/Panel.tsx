"use client";

import type { ReactNode } from "react";
import { fmtClock } from "@/lib/format";

type PanelProps = {
  title: string;
  subtitle?: string;
  headRight?: ReactNode;
  toolbar?: ReactNode;
  footLeft?: ReactNode;
  fetchedAt?: number | null;
  warnings?: string[];
  error?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
  relative?: boolean;
  children: ReactNode;
};

export default function Panel({
  title,
  subtitle,
  headRight,
  toolbar,
  footLeft,
  fetchedAt,
  warnings = [],
  error,
  loading,
  onRefresh,
  relative,
  children,
}: PanelProps) {
  const health = error ? "dead" : warnings.length ? "warn" : "live";

  return (
    <section className={`panel${relative ? " panel-rel" : ""}`}>
      <header className="panel-head">
        <span className="panel-title">{title}</span>
        {subtitle ? <span className="panel-sub">{subtitle}</span> : null}
        <span className="panel-head-right">
          {headRight}
          {onRefresh ? (
            <button
              className="icon-btn"
              onClick={onRefresh}
              title="Refresh now"
              aria-label={`Refresh ${title}`}
            >
              {loading ? "···" : "↻"}
            </button>
          ) : null}
        </span>
      </header>

      {toolbar}

      <div className="panel-body">{children}</div>

      <footer className="panel-foot">
        <span>
          <span className={`dot ${health}`} />
          {fetchedAt ? fmtClock(new Date(fetchedAt)) : "—"}
        </span>
        {footLeft}
        {error ? (
          <span className="warn" title={error}>
            {error}
          </span>
        ) : warnings.length ? (
          <span className="warn" title={warnings.join("\n")}>
            {warnings.length} source{warnings.length > 1 ? "s" : ""} degraded
          </span>
        ) : null}
      </footer>
    </section>
  );
}
