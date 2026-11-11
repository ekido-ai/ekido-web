"use client";

import { ArrowRight } from "lucide-react";
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
  if (!c) return <span className="italic text-muted">none fits</span>;
  return (
    <span className="tabular whitespace-nowrap">
      {c.micro_batch} × {c.accum} · {c.amp}
      {c.grad_ckpt ? " · grad ckpt" : ""}
    </span>
  );
}

/** Probe peak against capacity, with the 85% pass line drawn on the track. */
function ProbeBar({ row, synthetic }: { row: CompileRow; synthetic: boolean }) {
  if (synthetic) return <span className="text-sm italic text-muted">Not measured in CPU demo</span>;
  if (row.peakFrac === null || row.peakMib === null || row.capacityMib === null) {
    return <span className="text-sm italic text-muted">{row.verdict === "rejected" ? "no config fit" : "not recorded"}</span>;
  }
  const over = row.peakFrac > PROBE_LIMIT;
  return (
    <div className="min-w-44">
      <div className="tabular flex items-center justify-between gap-2 text-sm text-ink">
        <span>
          {row.peakMib} / {row.capacityMib} MiB
        </span>
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
          title={`Pass line: ${PROBE_LIMIT * 100}% of capacity`}
        />
      </div>
    </div>
  );
}

function laterRejected(s: DashboardState, providerId: string) {
  return s.failures.some((f) => f.provider_id === providerId && f.cause === "QUALITY_REJECTED");
}

export default function RecoveryPage() {
  const { state, mode, live } = useDashboard();
  const synthetic = mode === "live" && live.synthetic;
  const attempts = compileAttempts(state);
  const recs = recoveries(state);

  return (
    <div className="space-y-6">
      <PageHeader title="Recovery detail">
        {synthetic
          ? "This CPU demo probes each candidate with a synthetic workload. The reported capacity is a demo value, not GPU memory."
          : <>Why the system chose what it chose. Each candidate is compiled and probed on its provider. An estimate
            never approves a config: only a measured probe under {PROBE_LIMIT * 100}% of capacity does.</>}
      </PageHeader>

      {attempts.length === 0 && (
        <EmptyState title="No recoveries yet" action={<EmptyActions />}>
          When a provider fails or a result is rejected, every candidate the compiler considered shows up here with its
          reason.
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
                {r ? `Recovery ${index}: ${r.headline}` : "First placement"}
                {r?.injected && <TruthBadge truth="INJECTED_FAULT" />}
              </span>
            }
            subtitle={`${a.rows.length} candidate${a.rows.length === 1 ? "" : "s"} compiled`}
          >
            {chosen && (
              <div className="mb-5 rounded-lg border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusIcon tone="good" />
                  <span className="font-semibold text-ink">Chosen:</span>
                  <ProviderChip id={chosen.providerId} name={state.providers[chosen.providerId]?.name} />
                </div>
                {!chosen.from ? (
                  <p className="mt-2 text-ink-2">The job&apos;s first provider, so there was nothing to adapt from.</p>
                ) : changes.length === 0 ? (
                  <p className="mt-2 text-ink-2">Runs at the same config. Nothing about execution changed.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-ink">
                    {changes.map((c) => (
                      <li key={c.field} className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-2">{c.field}</span>
                        <span className="tabular font-semibold">{c.from}</span>
                        <ArrowRight className="size-4 text-muted" aria-label="to" />
                        <span className="tabular font-semibold">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {chosen.from && chosen.to && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink">
                    <StatusIcon tone={chosen.logicalBatchKept ? "good" : "critical"} />
                    Logical batch {chosen.logicalBatchKept ? "unchanged" : "CHANGED"}: {chosen.to.micro_batch} ×{" "}
                    {chosen.to.accum} = {chosen.to.micro_batch * chosen.to.accum}, before {chosen.from.micro_batch} ×{" "}
                    {chosen.from.accum} = {chosen.from.micro_batch * chosen.from.accum}. Same optimizer state, same
                    learning-rate schedule.
                  </p>
                )}
              </div>
            )}

            <ul className="divide-y divide-line text-sm sm:hidden">
              {a.rows.map((row) => (
                <li key={row.providerId} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProviderChip id={row.providerId} name={state.providers[row.providerId]?.name} />
                    <StatusPill tone={row.verdict === "accepted" ? "good" : "critical"}>{row.verdict === "accepted" ? "Can run it" : "Can't run it"}</StatusPill>
                  </div>
                  {state.providers[row.providerId]?.kind === "INJECTED_FAULT" && <TruthBadge truth="INJECTED_FAULT" />}
                  {row.verdict === "accepted" && laterRejected(state, row.providerId) && <p className="text-ink-2">Result later rejected by Quality Guard</p>}
                  <div className="flex items-center gap-2">{row.from && <><Config c={row.from} /><ArrowRight className="size-3.5 text-muted" aria-label="to" /></>}<Config c={row.to} /></div>
                  <ProbeBar row={row} synthetic={synthetic} />
                  {row.stepsPerS !== null && <p className="tabular text-ink-2">{row.stepsPerS} steps/s</p>}
                  <p className="text-ink-2">{row.reason}</p>
                </li>
              ))}
            </ul>
            <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-medium">Provider</th>
                    <th className="py-2 pr-4 font-medium">Decision</th>
                    <th className="py-2 pr-4 font-medium">Config (micro-batch × accumulation)</th>
                    <th className="py-2 pr-4 font-medium">Probe memory</th>
                    <th className="py-2 pr-4 font-medium">Probe speed</th>
                    <th className="py-2 font-medium">Why</th>
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
                          {row.verdict === "accepted" ? "Can run it" : "Can't run it"}
                        </StatusPill>
                        {row.verdict === "accepted" && laterRejected(state, row.providerId) && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
                            <StatusIcon tone="critical" className="size-3.5" />
                            Result later rejected by Quality Guard
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-2">
                          {row.from && (
                            <>
                              <Config c={row.from} />
                              <ArrowRight className="size-3.5 text-muted" aria-label="to" />
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
                          `${row.stepsPerS} steps/s`
                        ) : row.verdict === "rejected" ? (
                          <span className="text-muted">–</span>
                        ) : (
                          <span className="italic text-muted">unknown</span>
                        )}
                      </td>
                      <td className="py-3 text-ink-2">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              {synthetic
                ? "CPU demo profiles use declared capacity values; they do not measure GPU memory."
                : "Capped profiles are the same physical GPU with a memory cap. This shows memory adaptation, not a different GPU architecture."}
            </p>
          </Panel>
        );
      })}
    </div>
  );
}
