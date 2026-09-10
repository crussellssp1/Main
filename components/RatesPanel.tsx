"use client";

import { useMemo } from "react";
import Panel from "./Panel";
import { fmtBps, fmtPrice, signClass } from "@/lib/format";
import { useFeed } from "@/lib/useFeed";
import type { CurvePoint, RatesBoard } from "@/lib/types";

const LABELLED_TENORS = new Set(["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "30Y"]);

/** Curve plot: today's par curve against the prior session, log-spaced tenors. */
function CurveChart({ curve, prior }: { curve: CurvePoint[]; prior: CurvePoint[] }) {
  const pts = curve.filter((p) => p.yield !== null);
  if (pts.length < 3) return <div className="empty">CURVE UNAVAILABLE</div>;

  const W = 320;
  const H = 96;
  const PAD = { t: 8, r: 30, b: 14, l: 6 };

  const all = [...pts.map((p) => p.yield!), ...prior.map((p) => p.yield).filter((v): v is number => v !== null)];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = (hi - lo) * 0.15 || 0.1;
  lo -= pad;
  hi += pad;

  const minM = Math.log(pts[0].months);
  const maxM = Math.log(pts[pts.length - 1].months);
  const x = (months: number) =>
    PAD.l + ((Math.log(months) - minM) / (maxM - minM)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const path = (arr: CurvePoint[]) =>
    arr
      .filter((p) => p.yield !== null)
      .map((p, i) => `${i ? "L" : "M"}${x(p.months).toFixed(1)},${y(p.yield!).toFixed(1)}`)
      .join("");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Treasury par yield curve">
      {[0, 0.5, 1].map((f) => {
        const v = lo + (hi - lo) * f;
        return (
          <g key={f}>
            <line className="chart-grid-line" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="chart-axis-text" x={W - PAD.r + 3} y={y(v) + 3}>
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {prior.length ? <path d={path(prior)} fill="none" stroke="var(--label)" strokeWidth={1} strokeDasharray="3 2" /> : null}
      <path d={path(pts)} fill="none" stroke="var(--amber)" strokeWidth={1.5} />
      {pts.map((p) => (
        <g key={p.tenor}>
          <circle cx={x(p.months)} cy={y(p.yield!)} r={1.6} fill="var(--amber-bright)" />
          {/* Log spacing crowds the short end, so only anchor tenors get a
              label; the full set is in the table below. */}
          {LABELLED_TENORS.has(p.tenor) ? (
            <text className="chart-axis-text" x={x(p.months)} y={H - 3} textAnchor="middle">
              {p.tenor}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export default function RatesPanel() {
  // Curve and spread data are daily; a 5-minute poll is generous.
  const feed = useFeed<RatesBoard>("/api/rates", 300_000);
  const d = feed.data;

  const curveRows = useMemo(() => {
    if (!d) return [];
    const priorByTenor = new Map(d.priorCurve.map((p) => [p.tenor, p.yield]));
    return d.curve
      .filter((p) => p.yield !== null)
      .map((p) => {
        const prior = priorByTenor.get(p.tenor) ?? null;
        return {
          ...p,
          prior,
          changeBps: prior !== null && p.yield !== null ? (p.yield - prior) * 100 : null,
        };
      });
  }, [d]);

  const slope = useMemo(() => {
    const get = (t: string) => curveRows.find((r) => r.tenor === t)?.yield ?? null;
    const two = get("2Y");
    const ten = get("10Y");
    const three = get("3M");
    return {
      tens2s: two !== null && ten !== null ? (ten - two) * 100 : null,
      tens3m: three !== null && ten !== null ? (ten - three) * 100 : null,
    };
  }, [curveRows]);

  return (
    <Panel
      title="RATES & CREDIT"
      subtitle={d?.curveDate ? `UST PAR CURVE ${d.curveDate}` : "UST PAR CURVE"}
      fetchedAt={feed.fetchedAt}
      warnings={feed.warnings}
      error={feed.error}
      loading={feed.loading}
      onRefresh={feed.refresh}
      footLeft={
        <span>
          10s2s <b className={signClass(slope.tens2s)}>{fmtBps(slope.tens2s)}</b>
          {"   "}10s3m <b className={signClass(slope.tens3m)}>{fmtBps(slope.tens3m)}</b>
        </span>
      }
    >
      {feed.loading && !d ? (
        <div className="empty">LOADING CURVE AND SPREADS…</div>
      ) : (
        <>
          <div className="curve-wrap">
            <CurveChart curve={d?.curve ?? []} prior={d?.priorCurve ?? []} />
          </div>

          <div className="section-label">TREASURY PAR YIELDS</div>
          <table className="grid-table">
            <thead>
              <tr>
                <th>TENOR</th>
                <th>YIELD</th>
                <th>PRIOR</th>
                <th>CHG</th>
              </tr>
            </thead>
            <tbody>
              {curveRows.map((r) => (
                <tr key={r.tenor}>
                  <td>
                    <span className="sym">{r.tenor}</span>
                  </td>
                  <td>{r.yield !== null ? `${r.yield.toFixed(2)}%` : "—"}</td>
                  <td className="flat">{r.prior !== null ? `${r.prior.toFixed(2)}%` : "—"}</td>
                  <td className={signClass(r.changeBps)}>{fmtBps(r.changeBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-label">CREDIT SPREADS & POLICY RATES</div>
          <table className="grid-table">
            <thead>
              <tr>
                <th>SERIES</th>
                <th>LAST</th>
                <th>D/D</th>
                <th>ASOF</th>
              </tr>
            </thead>
            <tbody>
              {(d?.fred ?? []).map((f) => {
                const chgBps =
                  f.last !== null && f.prior !== null ? (f.last - f.prior) * 100 : null;
                return (
                  <tr key={f.id} title={f.error ? `${f.id}: ${f.error}` : `FRED series ${f.id}`}>
                    <td>
                      <span className="sym">{f.label}</span>
                    </td>
                    <td>{f.last !== null ? `${f.last.toFixed(2)}%` : "—"}</td>
                    <td className={signClass(chgBps)}>{fmtBps(chgBps)}</td>
                    <td className="flat" style={{ fontSize: 10 }}>
                      {f.date ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {d?.futures.length ? (
            <>
              <div className="section-label">RATE FUTURES</div>
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>CONTRACT</th>
                    <th>LAST</th>
                    <th>CHG</th>
                  </tr>
                </thead>
                <tbody>
                  {d.futures.map((f) => (
                    <tr key={f.symbol} title={f.name}>
                      <td>
                        <span className="sym">{f.symbol}</span>
                      </td>
                      <td>{fmtPrice(f.last)}</td>
                      <td className={signClass(f.change)}>
                        {f.change !== null
                          ? `${f.change >= 0 ? "+" : "-"}${Math.abs(f.change).toFixed(3)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {d?.notes.length ? (
            <div className="err" style={{ whiteSpace: "pre-wrap" }}>
              {d.notes.join("\n")}
            </div>
          ) : null}

          <div className="panel-foot" style={{ borderTop: "none", height: "auto", padding: "3px 6px", whiteSpace: "normal" }}>
            <em style={{ fontStyle: "italic" }}>
              Sources: US Treasury daily par yield curve; ICE BofA OAS indices and policy rates
              via FRED; rate futures via Yahoo Finance. Spread series settle with a one to two
              day lag.
            </em>
          </div>
        </>
      )}
    </Panel>
  );
}
