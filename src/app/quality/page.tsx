"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/lib/events/source-context";
import { providerName } from "@/lib/events/derive";
import { pts, qualityRows, qualitySentence, type QualityRow } from "@/lib/events/views";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { ProviderChip } from "@/components/ui/provider-chip";
import { StatusIcon, StatusPill } from "@/components/ui/status";
import { EmptyActions } from "@/components/shell/empty-actions";
import { EmptyState } from "@/components/ui/states";
import { Stat } from "@/components/ui/stat";
import { cx } from "@/components/ui/cx";

/** Big early gains (vs the untrained baseline) would squash the margin region; clip the scale here. */
const CLIP = 0.15;

/** Shared x-scale for every row's strip, in fractions (0.01 = 1 point). Values past the edge are clamped. */
function domainFor(rows: QualityRow[]) {
  const lo = Math.max(-CLIP, Math.min(...rows.map((r) => Math.min(r.ciLower, -r.margin))));
  const hi = Math.min(CLIP, Math.max(...rows.map((r) => r.delta), 0.02));
  const step = 0.05;
  const min = Math.floor((lo - 0.01) / step) * step;
  const max = Math.ceil((hi + 0.01) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(2));
  const x = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
  return { min, max, ticks, x };
}

/**
 * One row's strip: the one-sided 95% interval runs from the lower bound up through
 * the observed difference. The margin line is the pass/fail threshold.
 */
function Strip({ r, x, margin, max }: { r: QualityRow; x: (v: number) => number; margin: number; max: number }) {
  const pass = r.verdict === "pass";
  const offScale = r.delta > max;
  return (
    <div className="relative h-8" aria-hidden>
      <div className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(0)}%` }} />
      <div className="absolute inset-y-0 w-0.5 bg-critical" style={{ left: `${x(-margin)}%` }} />
      <div
        className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-2"
        style={{ left: `${x(r.ciLower)}%`, width: `${Math.max(0.5, x(r.delta) - x(r.ciLower))}%` }}
      />
      {/* lower-bound tick: this is the number the test uses */}
      <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-ink" style={{ left: `${x(r.ciLower)}%` }} />
      <div
        className={cx(
          "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface",
          pass ? "bg-good" : "bg-critical",
        )}
        style={{ left: `${x(r.delta)}%` }}
      />
      {offScale && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-1 text-xs text-muted">›</span>
      )}
    </div>
  );
}

export default function QualityPage() {
  const t = useTranslations("demo.quality");
  const verdictWord = (v: "pass" | "reject") => t(`verdict.${v}`);
  const { state, mode, live } = useDashboard();
  const synthetic = mode === "live" && live.synthetic;
  const rows = qualityRows(state);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.checkpointId === selectedId) ?? rows.at(-1) ?? null;
  const dom = domainFor(rows);
  const margin = rows[0]?.margin ?? 0.02;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        {t("lead", { margin: (margin * 100).toFixed(1) })}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} action={<EmptyActions />}>
          {t("empty")}
        </EmptyState>
      ) : (
        <>
          {selected && (
            <Panel
              title={
                <span className="inline-flex flex-wrap items-center gap-3">
                  <StatusPill tone={selected.verdict === "pass" ? "good" : "critical"} size="lg">
                    {t(selected.verdict === "pass" ? "passed" : "rejected")}
                  </StatusPill>
                  <span>
                    {t("providerStep", { provider: providerName(state, selected.providerId), step: selected.step ?? t("unknown") })}
                  </span>
                </span>
              }
              subtitle={selected.checkpointId}
            >
              <p className="max-w-4xl text-lg text-ink">{qualitySentence(selected)}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">
                <Stat label={t("candidate")} value={selected.candidate * 100} digits={1} unit="%" />
                <Stat label={t("reference")} value={selected.reference * 100} digits={1} unit="%" source={t("referenceSource")} />
                <Stat label={t("observed")} value={pts(selected.delta)} unit={t("pts")} />
                <Stat label={t("lowerBound")} value={pts(selected.ciLower)} unit={t("pts")} source={t("lowerBoundSource")} />
                <Stat label={t("evalSet")} value={selected.n} unit={t("examples")} source={t("evalSetSource")} />
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <div className="text-sm text-ink-2">
                  {t("verifiers", { agree: selected.verifiers.filter((v) => v.verdict === selected.verdict).length, total: selected.verifiers.length })}
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {selected.verifiers.map((v) => (
                    <li key={v.signer}>
                      <StatusPill tone={v.verdict === "pass" ? "good" : "critical"}>
                        <span className="font-mono">{v.signer}</span> · {verdictWord(v.verdict)}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}

          <Panel title={t("every")} subtitle={t("everySubtitle")}>
            {/* key */}
            <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <li className="flex items-center gap-2"><span className="h-4 w-0.5 bg-critical" aria-hidden />{t("keyMargin", { pts: pts(-margin) })}</li>
              <li className="flex items-center gap-2"><span className="h-4 w-0.5 bg-ink" aria-hidden />{t("keyLower")}</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-good" aria-hidden />{t("keyPassed")}</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-critical" aria-hidden />{t("keyRejected")}</li>
            </ul>

            <div className="-mx-5 overflow-x-auto px-5">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[13rem_1fr_7rem] items-end gap-4 border-b border-line px-2 pb-1 text-xs text-muted">
                  <span>{t("colCheckpoint")}</span>
                  <div className="relative h-4">
                    {dom.ticks.map((tick) => (
                      <span key={tick} className="tabular absolute -translate-x-1/2" style={{ left: `${dom.x(tick)}%` }}>
                        {tick === 0 ? "0" : pts(tick, 0)}
                      </span>
                    ))}
                  </div>
                  <span className="text-right">{t("colLower")}</span>
                </div>
                <ul>
                  {rows.map((r) => {
                    const sel = selected?.checkpointId === r.checkpointId;
                    return (
                      <li key={r.checkpointId}>
                        <button
                          type="button"
                          aria-pressed={sel}
                          onClick={() => setSelectedId(r.checkpointId)}
                          title={t("rowTitle", { provider: providerName(state, r.providerId), step: r.step ?? "?", delta: pts(r.delta), lower: pts(r.ciLower), verdict: verdictWord(r.verdict) })}
                          className={cx(
                            "grid w-full grid-cols-[13rem_1fr_7rem] items-center gap-4 rounded-md px-2 py-1 text-left",
                            sel ? "bg-surface-3" : "hover:bg-surface-2",
                          )}
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <StatusIcon tone={r.verdict === "pass" ? "good" : "critical"} />
                            {r.providerId ? <ProviderChip id={r.providerId} name={`${r.providerId}`} /> : "?"}
                            <span className="tabular text-ink-2">{t("step", { step: r.step ?? "?" })}</span>
                          </span>
                          <Strip r={r} x={dom.x} margin={r.margin} max={dom.max} />
                          <span className="tabular text-right text-sm text-ink">{t("ptsValue", { value: pts(r.ciLower) })}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {rows.some((r) => r.delta > dom.max) && (
              <p className="mt-3 text-xs text-muted">
                {t("offScale")}
              </p>
            )}
            <p className="mt-4 text-xs text-muted">
              {t(synthetic ? "noteSynthetic" : mode === "replay" ? "noteReplay" : "noteLive")}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
