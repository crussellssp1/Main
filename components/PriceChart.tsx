"use client";

import { useMemo, useRef, useState } from "react";
import { fmtPrice, fmtVolume } from "@/lib/format";
import type { Candle } from "@/lib/types";

type Props = {
  candles: Candle[];
  prevClose: number | null;
  symbol: string;
  intraday: boolean;
};

const PAD = { top: 10, right: 54, bottom: 16, left: 6 };
const VOL_FRAC = 0.18;

/**
 * Hand-rolled SVG price chart: line plus volume histogram, previous-close
 * reference and a crosshair readout. Rendering it directly keeps the terminal
 * dependency-free and lets the axes match the panel typography exactly.
 */
export default function PriceChart({ candles, prevClose, symbol, intraday }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 320 });
  const [hover, setHover] = useState<number | null>(null);

  // Measure once per layout pass; ResizeObserver keeps the SVG viewBox honest.
  const setRef = (node: HTMLDivElement | null) => {
    wrapRef.current = node;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize((prev) =>
          Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
            ? prev
            : { w: r.width, h: r.height }
        );
      }
    });
    ro.observe(node);
  };

  const geom = useMemo(() => {
    const closes = candles.map((c) => c.c).filter((v): v is number => v !== null);
    if (closes.length < 2) return null;

    const plotH = size.h - PAD.top - PAD.bottom;
    const priceH = plotH * (1 - VOL_FRAC);
    const volTop = PAD.top + priceH + 6;
    const volH = Math.max(0, plotH - priceH - 6);
    const plotW = size.w - PAD.left - PAD.right;

    // Include the previous close so the reference line never sits off-canvas.
    const candidates = prevClose !== null ? [...closes, prevClose] : closes;
    let lo = Math.min(...candidates);
    let hi = Math.max(...candidates);
    const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.01 || 1;
    lo -= pad;
    hi += pad;

    const x = (i: number) => PAD.left + (i / (candles.length - 1)) * plotW;
    const y = (v: number) => PAD.top + priceH - ((v - lo) / (hi - lo)) * priceH;

    const line = candles
      .map((c, i) => (c.c === null ? null : `${x(i).toFixed(1)},${y(c.c).toFixed(1)}`))
      .filter((p): p is string => p !== null);

    const area =
      `M${line[0]} ` +
      line.slice(1).map((p) => `L${p}`).join(" ") +
      ` L${x(candles.length - 1).toFixed(1)},${(PAD.top + priceH).toFixed(1)}` +
      ` L${PAD.left.toFixed(1)},${(PAD.top + priceH).toFixed(1)} Z`;

    const maxVol = Math.max(...candles.map((c) => c.v ?? 0), 1);
    const barW = Math.max(0.7, plotW / candles.length - 0.4);

    const ticks = 5;
    const priceTicks = Array.from({ length: ticks }, (_, i) => {
      const v = lo + ((hi - lo) * i) / (ticks - 1);
      return { v, y: y(v) };
    });

    const timeTicks = Array.from({ length: 5 }, (_, i) => {
      const idx = Math.round((i / 4) * (candles.length - 1));
      return { idx, x: x(idx), t: candles[idx].t };
    });

    return {
      x,
      y,
      line: `M${line[0]} ${line.slice(1).map((p) => `L${p}`).join(" ")}`,
      area,
      priceTicks,
      timeTicks,
      volTop,
      volH,
      maxVol,
      barW,
      priceH,
      plotW,
      lo,
      hi,
    };
  }, [candles, prevClose, size.h, size.w]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!geom || candles.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - PAD.left;
    const idx = Math.round((rel / geom.plotW) * (candles.length - 1));
    setHover(Math.min(candles.length - 1, Math.max(0, idx)));
  };

  const tf = (t: number) =>
    new Intl.DateTimeFormat("en-US", {
      ...(intraday
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : { month: "short", day: "2-digit", year: "2-digit" }),
      timeZone: "America/New_York",
    }).format(new Date(t));

  if (!geom) {
    return <div className="empty">NO PRICE HISTORY RETURNED FOR {symbol}</div>;
  }

  const cur = hover !== null ? candles[hover] : candles[candles.length - 1];
  const curChange =
    cur.c !== null && prevClose !== null ? ((cur.c - prevClose) / Math.abs(prevClose)) * 100 : null;

  return (
    <div className="chart-wrap" ref={setRef}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${symbol} price chart`}
      >
        <defs>
          <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {geom.priceTicks.map((t, i) => (
          <g key={`p${i}`}>
            <line
              className="chart-grid-line"
              x1={PAD.left}
              x2={size.w - PAD.right}
              y1={t.y}
              y2={t.y}
            />
            <text
              className="chart-axis-text"
              x={size.w - PAD.right + 4}
              y={t.y + 3}
              textAnchor="start"
            >
              {fmtPrice(t.v, symbol)}
            </text>
          </g>
        ))}

        {geom.timeTicks.map((t, i) => (
          <text
            key={`t${i}`}
            className="chart-axis-text"
            x={t.x}
            y={size.h - 4}
            textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
          >
            {tf(t.t)}
          </text>
        ))}

        {candles.map((c, i) =>
          c.v ? (
            <rect
              key={`v${i}`}
              x={geom.x(i) - geom.barW / 2}
              y={geom.volTop + geom.volH - (c.v / geom.maxVol) * geom.volH}
              width={geom.barW}
              height={(c.v / geom.maxVol) * geom.volH}
              fill={
                c.o !== null && c.c !== null && c.c < c.o
                  ? "rgba(255,75,75,0.5)"
                  : "rgba(47,211,111,0.42)"
              }
            />
          ) : null
        )}

        <path className="chart-area" d={geom.area} />
        <path className="chart-line" d={geom.line} />

        {prevClose !== null &&
        prevClose >= geom.lo &&
        prevClose <= geom.hi ? (
          <>
            <line
              className="chart-prev-line"
              x1={PAD.left}
              x2={size.w - PAD.right}
              y1={geom.y(prevClose)}
              y2={geom.y(prevClose)}
            />
            <text
              className="chart-axis-text"
              x={size.w - PAD.right + 4}
              y={geom.y(prevClose) - 3}
              fill="var(--label)"
            >
              PREV
            </text>
          </>
        ) : null}

        {hover !== null && cur.c !== null ? (
          <>
            <line
              className="chart-cross"
              x1={geom.x(hover)}
              x2={geom.x(hover)}
              y1={PAD.top}
              y2={geom.volTop + geom.volH}
            />
            <line
              className="chart-cross"
              x1={PAD.left}
              x2={size.w - PAD.right}
              y1={geom.y(cur.c)}
              y2={geom.y(cur.c)}
            />
            <circle cx={geom.x(hover)} cy={geom.y(cur.c)} r={2.4} fill="var(--amber-bright)" />
          </>
        ) : null}
      </svg>

      <div className="chart-readout">
        <span className="k">{tf(cur.t)}</span>
        <span>
          <span className="k">O </span>
          <b>{fmtPrice(cur.o, symbol)}</b>
        </span>
        <span>
          <span className="k">H </span>
          <b>{fmtPrice(cur.h, symbol)}</b>
        </span>
        <span>
          <span className="k">L </span>
          <b>{fmtPrice(cur.l, symbol)}</b>
        </span>
        <span>
          <span className="k">C </span>
          <b>{fmtPrice(cur.c, symbol)}</b>
        </span>
        <span>
          <span className="k">VOL </span>
          <b>{fmtVolume(cur.v)}</b>
        </span>
        {curChange !== null ? (
          <span className={curChange >= 0 ? "up" : "down"}>
            {curChange >= 0 ? "+" : ""}
            {curChange.toFixed(2)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
