"use client";

import { useState } from "react";
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
  const { state, mode, live } = useDashboard();
  const synthetic = mode === "live" && live.synthetic;
  const rows = qualityRows(state);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.checkpointId === selectedId) ?? rows.at(-1) ?? null;
  const dom = domainFor(rows);
  const margin = rows[0]?.margin ?? 0.02;

  return (
    <div className="space-y-6">
      <PageHeader title="Quality result">
        Every checkpoint is compared with the last accepted one on a fixed evaluation set. It passes only if, with 95%
        confidence, it is no more than {(margin * 100).toFixed(1)} accuracy points worse. The policy was fixed before
        training started.
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState title="No evaluations yet" action={<EmptyActions />}>
          The first result appears when the first checkpoint is committed and verifiers have scored it.
        </EmptyState>
      ) : (
        <>
          {selected && (
            <Panel
              title={
                <span className="inline-flex flex-wrap items-center gap-3">
                  <StatusPill tone={selected.verdict === "pass" ? "good" : "critical"} size="lg">
                    {selected.verdict === "pass" ? "Passed" : "Rejected"}
                  </StatusPill>
                  <span>
                    {providerName(state, selected.providerId)}, step {selected.step ?? "unknown"}
                  </span>
                </span>
              }
              subtitle={selected.checkpointId}
            >
              <p className="max-w-4xl text-lg text-ink">{qualitySentence(selected)}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">
                <Stat label="Candidate accuracy" value={selected.candidate * 100} digits={1} unit="%" />
                <Stat label="Reference accuracy" value={selected.reference * 100} digits={1} unit="%" source="Last accepted checkpoint" />
                <Stat label="Observed difference" value={pts(selected.delta)} unit="pts" />
                <Stat label="95% lower bound" value={pts(selected.ciLower)} unit="pts" source="Paired bootstrap, one-sided" />
                <Stat label="Evaluation set" value={selected.n} unit="examples" source="Hash pinned in policy" />
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <div className="text-sm text-ink-2">
                  Verifiers: {selected.verifiers.filter((v) => v.verdict === selected.verdict).length} of{" "}
                  {selected.verifiers.length} agree. These verifiers are run by our team, so this is permissioned, not
                  trustless.
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {selected.verifiers.map((v) => (
                    <li key={v.signer}>
                      <StatusPill tone={v.verdict === "pass" ? "good" : "critical"}>
                        <span className="font-mono">{v.signer}</span> · {v.verdict}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}

          <Panel title="Every evaluation" subtitle="Difference from the reference, in accuracy points. Select a row for its verdict.">
            {/* key */}
            <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <li className="flex items-center gap-2"><span className="h-4 w-0.5 bg-critical" aria-hidden />Margin: fail line at {pts(-margin)} pts</li>
              <li className="flex items-center gap-2"><span className="h-4 w-0.5 bg-ink" aria-hidden />95% lower bound (what the test uses)</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-good" aria-hidden />Observed difference, passed</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-critical" aria-hidden />Observed difference, rejected</li>
            </ul>

            <div className="-mx-5 overflow-x-auto px-5">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[13rem_1fr_7rem] items-end gap-4 border-b border-line px-2 pb-1 text-xs text-muted">
                  <span>Checkpoint</span>
                  <div className="relative h-4">
                    {dom.ticks.map((t) => (
                      <span key={t} className="tabular absolute -translate-x-1/2" style={{ left: `${dom.x(t)}%` }}>
                        {t === 0 ? "0" : pts(t, 0)}
                      </span>
                    ))}
                  </div>
                  <span className="text-right">Lower bound</span>
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
                          title={`${providerName(state, r.providerId)} step ${r.step}: difference ${pts(r.delta)} pts, lower bound ${pts(r.ciLower)} pts, ${r.verdict}`}
                          className={cx(
                            "grid w-full grid-cols-[13rem_1fr_7rem] items-center gap-4 rounded-md px-2 py-1 text-left",
                            sel ? "bg-surface-3" : "hover:bg-surface-2",
                          )}
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <StatusIcon tone={r.verdict === "pass" ? "good" : "critical"} />
                            {r.providerId ? <ProviderChip id={r.providerId} name={`${r.providerId}`} /> : "?"}
                            <span className="tabular text-ink-2">step {r.step ?? "?"}</span>
                          </span>
                          <Strip r={r} x={dom.x} margin={r.margin} max={dom.max} />
                          <span className="tabular text-right text-sm text-ink">{pts(r.ciLower)} pts</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {rows.some((r) => r.delta > dom.max) && (
              <p className="mt-3 text-xs text-muted">
                › Off the scale to the right: early checkpoints compared with the untrained baseline. Their exact values
                are in the Lower bound column.
              </p>
            )}
            <p className="mt-4 text-xs text-muted">
              {synthetic
                ? "This CPU demo uses synthetic evaluation data; these accuracy numbers are not from AG News."
                : mode === "replay"
                  ? "The recorded run used public AG News test data, so a provider could have trained on it. Production needs a client-private holdout."
                  : "Check the job policy to identify the evaluation set. Production needs a client-private holdout."}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
