"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { DashboardState } from "@/lib/events/reduce";
import { checkpointMarks, lossSegments, providerName, type LossSegment } from "@/lib/events/derive";
import { cx } from "@/components/ui/cx";

const H = 175;
const PAD = { top: 16, right: 92, bottom: 34, left: 48 };

/** CSS color for a provider's line. P (and unknown ids) use muted ink. */
function strokeFor(id: string): string {
  return ({ A: "var(--series-1)", B: "var(--series-2)", R: "var(--series-3)", C: "var(--series-4)" } as Record<string, string>)[id] ?? "var(--muted)";
}

/** Clean y ticks: smallest step from a fixed set that needs at most 6 ticks. */
function niceTicks(maxValue: number): { max: number; ticks: number[] } {
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 5].find((s) => maxValue / s <= 6) ?? 10;
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => +(i * step).toFixed(2));
  return { max, ticks };
}

/**
 * Callback ref, not an effect: the measured element mounts later than the component
 * (the chart starts empty in live mode), and an effect with [] would never see it.
 */
function useWidth<T extends HTMLElement>() {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    ro.current = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.current.observe(el);
  }, []);
  return [ref, w] as const;
}

/** Point in the segment nearest to `step`, or null if the segment doesn't cover it. */
function pointAt(seg: LossSegment, step: number) {
  const first = seg.points[0]?.step ?? Infinity;
  const last = seg.points.at(-1)?.step ?? -Infinity;
  if (step < first - 2 || step > last + 2) return null;
  return seg.points.reduce((a, b) => (Math.abs(b.step - step) < Math.abs(a.step - step) ? b : a));
}

export function LossChart({ state, showTable = false }: { state: DashboardState; showTable?: boolean }) {
  const t = useTranslations("demo.loss");
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [cursor, setCursor] = useState<number | null>(null);
  const segs = useMemo(() => lossSegments(state), [state]);
  const marks = useMemo(() => checkpointMarks(state, segs), [state, segs]);
  const total = state.progress.at(-1)?.total_steps ?? 300;
  const { max: maxLoss, ticks: yTicks } = niceTicks(Math.max(0.5, ...state.progress.map((p) => p.loss)) * 1.05);

  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = H - PAD.top - PAD.bottom;
  const x = (step: number) => PAD.left + (step / total) * iw;
  const y = (loss: number) => PAD.top + ih - (loss / maxLoss) * ih;
  // About 8 labels at any job length, on round numbers, so they never run into each other.
  const xStep = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find((s) => total / s <= 8) ?? Math.ceil(total / 8);
  const xTicks = Array.from({ length: Math.floor(total / xStep) + 1 }, (_, i) => i * xStep);

  const toStep = (clientX: number, rect: DOMRect) =>
    Math.round(Math.min(total, Math.max(0, ((clientX - rect.left - PAD.left) / iw) * total)));

  const readout =
    cursor === null
      ? []
      : segs
          .map((s) => ({ seg: s, pt: pointAt(s, cursor) }))
          .filter((r): r is { seg: LossSegment; pt: { step: number; loss: number } } => r.pt !== null);

  const providersInChart = [...new Map(segs.map((s) => [s.providerId, s])).values()];

  if (segs.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-line-strong text-ink-2">
        {t("empty")}
      </div>
    );
  }

  return (
    <div>
      {/* Legend: mirrors the marks (line keys), always present for ≥ 2 series. */}
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2" aria-label={t("legend")}>
        {providersInChart.map((s) => (
          <li key={s.providerId} className="flex items-center gap-2">
            <svg width="20" height="8" aria-hidden>
              <line x1="0" y1="4" x2="20" y2="4" stroke={strokeFor(s.providerId)} strokeWidth="2"
                strokeDasharray={s.rejected ? "4 3" : undefined} />
            </svg>
            {providerName(state, s.providerId)}
            {s.rejected && <span className="text-muted">{t("rejectedDashed")}</span>}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill="var(--surface)" stroke="var(--good)" strokeWidth="2" /></svg>
          {t("accepted")}
        </li>
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" /></svg>
          {t("checking")}
        </li>
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden><path d="M2 2L10 10M10 2L2 10" stroke="var(--critical)" strokeWidth="2" /></svg>
          {t("rejectedMark")}
        </li>
      </ul>

      <div ref={wrapRef} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={t("aria", { n: segs.length })}
            tabIndex={0}
            className="block rounded-md focus-visible:outline-2"
            onPointerMove={(e) => setCursor(toStep(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setCursor(null)}
            onBlur={() => setCursor(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setCursor((c) => Math.min(total, (c ?? 0) + 5));
              else if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, (c ?? total) - 5));
              else if (e.key === "Escape") setCursor(null);
              else return;
              e.preventDefault();
            }}
          >
            {/* grid + axes: hairline, recessive */}
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={PAD.left + iw} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" strokeWidth="1" />
                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="tabular fill-[var(--muted)] text-[12px]">
                  {tick.toFixed(2)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => (
              <text key={tick} x={x(tick)} y={H - PAD.bottom + 20} textAnchor="middle" className="tabular fill-[var(--muted)] text-[12px]">
                {tick}
              </text>
            ))}
            <line x1={PAD.left} x2={PAD.left + iw} y1={PAD.top + ih} y2={PAD.top + ih} stroke="var(--border-strong)" />
            <text x={PAD.left + iw} y={H - 2} textAnchor="end" className="fill-[var(--muted)] text-[12px]">
              {t("axis")}
            </text>

            {/* lines */}
            {segs.map((s) => (
              <polyline
                key={s.attempt}
                fill="none"
                stroke={strokeFor(s.providerId)}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.rejected ? "6 4" : undefined}
                opacity={s.rejected ? 0.8 : 1}
                points={s.points.map((p) => `${x(p.step)},${y(p.loss)}`).join(" ")}
              />
            ))}

            {/* checkpoint marks, with a surface ring so they read over lines */}
            {marks.map((m) =>
              m.state === "REJECTED" ? (
                <g key={m.id} transform={`translate(${x(m.step)},${y(m.loss)})`}>
                  <circle r="7" fill="var(--surface)" />
                  <path d="M-4 -4L4 4M4 -4L-4 4" stroke="var(--critical)" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              ) : (
                <circle
                  key={m.id}
                  cx={x(m.step)}
                  cy={y(m.loss)}
                  r="4.5"
                  fill="var(--surface)"
                  stroke={m.state === "ACCEPTED" ? "var(--good)" : "var(--muted)"}
                  strokeWidth="2"
                />
              ),
            )}

            {/* end labels + live dot: direct labels in text ink, identity from the dot */}
            {segs.map((s) => {
              const last = s.points.at(-1)!;
              return (
                <g key={`end-${s.attempt}`}>
                  <circle cx={x(last.step)} cy={y(last.loss)} r="4" fill={strokeFor(s.providerId)} stroke="var(--surface)" strokeWidth="2" />
                  {s.live && (
                    <circle cx={x(last.step)} cy={y(last.loss)} r="9" fill="none" stroke={strokeFor(s.providerId)} strokeWidth="1.5" opacity="0.6" />
                  )}
                  <text x={x(last.step) + 10} y={y(last.loss)} dy="0.32em" className="fill-[var(--text-2)] text-[13px] font-medium">
                    {s.providerId}
                    {s.rejected ? t("endRejected") : ""}
                  </text>
                </g>
              );
            })}

            {/* crosshair */}
            {cursor !== null && (
              <g pointerEvents="none">
                <line x1={x(cursor)} x2={x(cursor)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--text-2)" strokeWidth="1" />
                {readout.map((r) => (
                  <circle key={r.seg.attempt} cx={x(r.pt.step)} cy={y(r.pt.loss)} r="4" fill={strokeFor(r.seg.providerId)} stroke="var(--surface)" strokeWidth="2" />
                ))}
              </g>
            )}
          </svg>
        )}

        {cursor !== null && (
          <div
            role="status"
            className={cx(
              "pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm shadow-lg",
            )}
            style={x(cursor) > width / 2 ? { right: width - x(cursor) + 12 } : { left: x(cursor) + 12 }}
          >
            <div className="tabular text-xs text-muted">{t("step", { step: cursor })}</div>
            {readout.length === 0 ? (
              <div className="text-ink-2">{t("noData")}</div>
            ) : (
              readout.map((r) => (
                <div key={r.seg.attempt} className="mt-1 flex items-center gap-2">
                  <svg width="14" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="14" y2="3" stroke={strokeFor(r.seg.providerId)} strokeWidth="2"
                      strokeDasharray={r.seg.rejected ? "3 2" : undefined} />
                  </svg>
                  <span className="tabular font-semibold text-ink">{r.pt.loss.toFixed(3)}</span>
                  <span className="text-ink-2">
                    {providerName(state, r.seg.providerId)}
                    {r.seg.rejected ? t("rejectedParen") : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Table view: every segment's numbers without hovering. */}
      {showTable && (
        <table className="tabular mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-medium">{t("colAttempt")}</th>
              <th className="py-1 font-medium">{t("colProvider")}</th>
              <th className="py-1 font-medium">{t("colSteps")}</th>
              <th className="py-1 font-medium">{t("colLoss")}</th>
              <th className="py-1 font-medium">{t("colResult")}</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {segs.map((s) => (
              <tr key={s.attempt} className="border-t border-line">
                <td className="py-1">{s.attempt}</td>
                <td className="py-1">{providerName(state, s.providerId)}</td>
                <td className="py-1">{s.points[0].step}–{s.points.at(-1)!.step}</td>
                <td className="py-1">{s.points.at(-1)!.loss.toFixed(3)}</td>
                <td className="py-1">{t(s.rejected ? "rejected" : s.live ? "training" : "kept")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
