"use client";

type Props = {
  values: number[];
  width?: number;
  height?: number;
  baseline?: number | null;
};

/**
 * Inline intraday sparkline for the quote board. Coloured against the
 * previous close so a row reads green or red at a glance.
 */
export default function Sparkline({ values, width = 58, height = 13, baseline }: Props) {
  if (values.length < 2) {
    return <svg className="spark" width={width} height={height} aria-hidden="true" />;
  }

  const base = baseline ?? values[0];
  const lo = Math.min(...values, base);
  const hi = Math.max(...values, base);
  const span = hi - lo || 1;

  const x = (i: number) => (i / (values.length - 1)) * (width - 1) + 0.5;
  const y = (v: number) => height - 1.5 - ((v - lo) / span) * (height - 3);

  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values[values.length - 1];
  const stroke = last >= base ? "var(--up)" : "var(--down)";

  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <line
        x1={0}
        x2={width}
        y1={y(base)}
        y2={y(base)}
        stroke="#3a3a3a"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.1} />
    </svg>
  );
}
