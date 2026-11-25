"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/lib/events/source-context";
import { recoveries } from "@/lib/events/derive";
import { compileAttempts, configChanges, PROBE_LIMIT, type CompileRow } from "@/lib/events/views";
import type { DashboardState } from "@/lib/events/reduce";
import type { ExecConfig } from "@/lib/events/types";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { ProviderChip } from "@/components/ui/provider-chip";
import { StatusIcon, StatusPill } from "@/components/ui/status";
import { EmptyActions } from "@/components/shell/empty-actions";
import { EmptyState } from "@/components/ui/states";
import { TruthBadge } from "@/components/ui/truth-badge";

function Config({ c }: { c: ExecConfig | null }) {
  const t = useTranslations("demo.recovery");
  if (!c) return <span className="italic text-muted">{t("noneFits")}</span>;
  return (
    <span className="tabular whitespace-nowrap">
      {c.micro_batch} × {c.accum} · {c.amp}
      {c.grad_ckpt ? t("gradCkpt") : ""}
    </span>
  );
}

/** Probe peak against capacity, with the 85% pass line drawn on the track. */
function ProbeBar({ row, synthetic }: { row: CompileRow; synthetic: boolean }) {
  const t = useTranslations("demo.recovery");
  if (synthetic) return <span className="text-sm italic text-muted">{t("notMeasuredCpu")}</span>;
  if (row.peakFrac === null || row.peakMib === null || row.capacityMib === null) {
    return <span className="text-sm italic text-muted">{t(row.verdict === "rejected" ? "noConfigFit" : "notRecorded")}</span>;
  }
  const over = row.peakFrac > PROBE_LIMIT;
  return (
    <div className="min-w-44">
      <div className="tabular flex items-center justify-between gap-2 text-sm text-ink">
        <span>{t("memory", { peak: row.peakMib, capacity: row.capacityMib })}</span>
        <span className="flex items-center gap-1 text-ink-2">
          {over && <StatusIcon tone="warning" className="size-3.5" />}
          {Math.round(row.peakFrac * 100)}%
        </span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.min(1, row.peakFrac) * 100}%` }} />
        <div
          className="absolute -top-1 h-4 w-0.5 bg-ink"
          style={{ left: `${PROBE_LIMIT * 100}%` }}
          title={t("passLine", { pct: PROBE_LIMIT * 100 })}
        />
      </div>
    </div>
  );
}

function laterRejected(s: DashboardState, providerId: string) {
  return s.failures.some((f) => f.provider_id === providerId && f.cause === "QUALITY_REJECTED");
}

export default function RecoveryPage() {
  const t = useTranslations("demo.recovery");
  const { state, mode, live } = useDashboard();
  const synthetic = mode === "live" && live.synthetic;
  const attempts = compileAttempts(state);
  const recs = recoveries(state);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        {synthetic ? t("leadSynthetic") : t("lead", { pct: PROBE_LIMIT * 100 })}
      </PageHeader>

      {attempts.length === 0 && (
        <EmptyState title={t("emptyTitle")} action={<EmptyActions />}>
          {t("empty")}
        </EmptyState>
      )}

      {[...attempts].reverse().map((a) => {
        const r = recs.find((x) => x.attempt === a.attempt);
        const index = recs.findIndex((x) => x.attempt === a.attempt) + 1;
        // Several candidates can fit. Only the one really assigned is "chosen".
        const assigned = r?.replacementId ?? state.progress[0]?.provider_id;
        const chosen = a.rows.find((x) => x.verdict === "accepted" && x.providerId === assigned) ?? a.rows.find((x) => x.verdict === "accepted");
        const changes = chosen ? configChanges(chosen.from, chosen.to) : [];
        return (
          <Panel
            key={a.attempt}
            title={
              <span className="inline-flex flex-wrap items-center gap-2">
                {r ? t("recovery", { index, headline: r.headline }) : t("firstPlacement")}
                {r?.injected && <TruthBadge truth="INJECTED_FAULT" />}
              </span>
            }
            subtitle={t("candidates", { n: a.rows.length })}
          >
            {chosen && (
              <div className="mb-5 rounded-lg border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusIcon tone="good" />
                  <span className="font-semibold text-ink">{t("chosen")}</span>
                  <ProviderChip id={chosen.providerId} name={state.providers[chosen.providerId]?.name} />
                </div>
                {!chosen.from ? (
                  <p className="mt-2 text-ink-2">{t("firstProvider")}</p>
                ) : changes.length === 0 ? (
                  <p className="mt-2 text-ink-2">{t("sameConfig")}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-ink">
                    {changes.map((c) => (
                      <li key={c.field} className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-2">{c.field}</span>
                        <span className="tabular font-semibold">{c.from}</span>
                        <ArrowRight className="size-4 text-muted" aria-label={t("to")} />
                        <span className="tabular font-semibold">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {chosen.from && chosen.to && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                    <StatusIcon tone={chosen.logicalBatchKept ? "good" : "critical"} />
                    {t(chosen.logicalBatchKept ? "batchKept" : "batchChanged", {
                      mb: chosen.to.micro_batch,
                      acc: chosen.to.accum,
                      total: chosen.to.micro_batch * chosen.to.accum,
                      fromMb: chosen.from.micro_batch,
                      fromAcc: chosen.from.accum,
                      fromTotal: chosen.from.micro_batch * chosen.from.accum,
                    })}
                  </p>
                )}
              </div>
            )}

            <ul className="divide-y divide-line text-sm sm:hidden">
              {a.rows.map((row) => (
                <li key={row.providerId} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProviderChip id={row.providerId} name={state.providers[row.providerId]?.name} />
                    <StatusPill tone={row.verdict === "accepted" ? "good" : "critical"}>{t(row.verdict === "accepted" ? "canRun" : "cantRun")}</StatusPill>
                  </div>
                  {state.providers[row.providerId]?.kind === "INJECTED_FAULT" && <TruthBadge truth="INJECTED_FAULT" />}
                  {row.verdict === "accepted" && laterRejected(state, row.providerId) && <p className="text-ink-2">{t("laterRejected")}</p>}
                  <div className="flex items-center gap-2">{row.from && <><Config c={row.from} /><ArrowRight className="size-3.5 text-muted" aria-label={t("to")} /></>}<Config c={row.to} /></div>
                  <ProbeBar row={row} synthetic={synthetic} />
                  {row.stepsPerS !== null && <p className="tabular text-ink-2">{t("stepsPerS", { n: row.stepsPerS })}</p>}
                  <p className="text-ink-2">{row.reason}</p>
                </li>
              ))}
            </ul>
            <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-medium">{t("colProvider")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colDecision")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colConfig")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colMemory")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colSpeed")}</th>
                    <th className="py-2 font-medium">{t("colWhy")}</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {a.rows.map((row) => (
                    <tr key={row.providerId} className="border-b border-line align-top last:border-0">
                      <td className="py-3 pr-4">
                        <ProviderChip id={row.providerId} name={state.providers[row.providerId]?.name} />
                        {state.providers[row.providerId]?.kind === "INJECTED_FAULT" && (
                          <div className="mt-1">
                            <TruthBadge truth="INJECTED_FAULT" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusPill tone={row.verdict === "accepted" ? "good" : "critical"}>
                          {t(row.verdict === "accepted" ? "canRun" : "cantRun")}
                        </StatusPill>
                        {row.verdict === "accepted" && laterRejected(state, row.providerId) && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
                            <StatusIcon tone="critical" className="size-3.5" />
                            {t("laterRejected")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-2">
                          {row.from && (
                            <>
                              <Config c={row.from} />
                              <ArrowRight className="size-3.5 text-muted" aria-label={t("to")} />
                            </>
                          )}
                          <Config c={row.to} />
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <ProbeBar row={row} synthetic={synthetic} />
                      </td>
                      <td className="tabular py-3 pr-4">
                        {row.stepsPerS !== null ? (
                          t("stepsPerS", { n: row.stepsPerS })
                        ) : row.verdict === "rejected" ? (
                          <span className="text-muted">–</span>
                        ) : (
                          <span className="italic text-muted">{t("unknown")}</span>
                        )}
                      </td>
                      <td className="py-3 text-ink-2">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              {t(synthetic ? "noteSynthetic" : "note")}
            </p>
          </Panel>
        );
      })}
    </div>
  );
}
