"use client";

import { useDashboard } from "@/lib/events/source-context";
import { providerName } from "@/lib/events/derive";
import { settlementView, usdc } from "@/lib/events/views";
import { PageHeader } from "@/components/shell/page-header";
import { ReceiptDownload } from "@/components/settlement/receipt-download";
import { Panel } from "@/components/ui/panel";
import { ProviderChip, providerSwatch } from "@/components/ui/provider-chip";
import { StatusIcon, StatusPill, type Tone } from "@/components/ui/status";
import { EmptyActions } from "@/components/shell/empty-actions";
import { EmptyState, TxStatus } from "@/components/ui/states";
import { TruthBadge } from "@/components/ui/truth-badge";
import { cx } from "@/components/ui/cx";

const txLabel: Record<string, string> = {
  createJob: "Escrow funded (createJob)",
  markActive: "Job activated (markActive)",
  anchorEvent: "Recovery anchored (anchorEvent)",
  submitAttestation: "Verifier attestation (submitAttestation)",
  finalize: "Payment finalized (finalize)",
  withdraw: "Withdrawal",
};

function phase(state: string | null): { tone: Tone; text: string } {
  switch (state) {
    case "SETTLED":
      return { tone: "good", text: "Settled. Providers can withdraw" };
    case "COMPLETED":
      return { tone: "warning", text: "Dispute window open. Nothing paid out yet" };
    case "DISPUTED":
      return { tone: "serious", text: "Disputed. Waiting for the arbiter" };
    case "REFUNDED":
      return { tone: "neutral", text: "Client refunded in full" };
    default:
      return { tone: "idle", text: "Not settled yet" };
  }
}

export default function SettlementPage() {
  const { state, provenance } = useDashboard();
  const v = settlementView(state);
  const ph = phase(state.jobState);
  const localChain = state.chain.some((t) => t.chain === "anvil");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settlement"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {localChain && <TruthBadge truth="LOCAL_CHAIN" />}
            <ReceiptDownload state={state} source={provenance} />
            <StatusPill tone={ph.tone} size="lg">
              {ph.text}
            </StatusPill>
          </div>
        }
      >
        Paid for accepted work only. Each provider earns its accepted steps times its rate. Rejected work and steps that
        were never saved earn nothing, and the rest of the budget goes back to the client.
      </PageHeader>

      {!v ? (
        <EmptyState title="No settlement yet" action={<EmptyActions />}>
          The split appears after the final evaluation passes and the verifiers sign the attestation.
        </EmptyState>
      ) : (
        <>
          <Panel title={`Where the ${usdc(v.budgetMicros)} USDC budget went`} subtitle={localChain ? "Test USDC on a local chain" : "Test USDC, testnet only"}>
            {/* Tall segmented bar: one whole split into parts, with a legend. */}
            <div
              className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md"
              role="img"
              aria-label={v.parts.map((p) => `${p.label} ${usdc(p.micros)} USDC`).join(", ")}
            >
              {v.parts.map((p) => (
                <div
                  key={p.key}
                  className={cx("h-full", p.providerId ? providerSwatch(p.providerId) : "bg-surface-3")}
                  style={{ width: `${p.frac * 100}%` }}
                  title={`${p.label}: ${usdc(p.micros)} USDC (${Math.round(p.frac * 100)}%)`}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {v.parts.map((p) => (
                <li key={p.key} className="flex items-center gap-2">
                  <span
                    className={cx("size-3 rounded-sm", p.providerId ? providerSwatch(p.providerId) : "bg-surface-3 ring-1 ring-line-strong")}
                    aria-hidden
                  />
                  <span className="text-ink-2">{p.label}</span>
                  <span className="tabular font-semibold text-ink">{usdc(p.micros)} USDC</span>
                  <span className="tabular text-sm text-muted">{Math.round(p.frac * 100)}%</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Who got paid, and why">
            <ul className="divide-y divide-line text-sm sm:hidden">
              {v.payees.map((p) => (
                <li key={p.providerId} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProviderChip id={p.providerId} name={providerName(state, p.providerId)} />
                    <strong className="tabular">{usdc(p.micros)} USDC</strong>
                  </div>
                  <p className="text-ink-2">{p.steps} accepted steps · {p.microsPerStep !== null ? `${usdc(p.microsPerStep)} USDC per step` : "rate unknown"}</p>
                </li>
              ))}
              {v.zeroPaid.map((z) => (
                <li key={z.providerId} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProviderChip id={z.providerId} name={providerName(state, z.providerId)} />
                    <strong>0.00 USDC</strong>
                  </div>
                  <p className="text-ink-2">0 accepted steps ({z.rejectedSteps} rejected) · {z.reason}</p>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 py-3"><span>Refund to client</span><strong>{usdc(v.refundMicros)} USDC</strong></li>
            </ul>
            <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
              <table className="tabular w-full min-w-[640px] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-medium">Who</th>
                    <th className="py-2 pr-4 text-right font-medium">Accepted steps</th>
                    <th className="py-2 pr-4 text-right font-medium">Rate</th>
                    <th className="py-2 pr-4 text-right font-medium">Paid</th>
                    <th className="py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {v.payees.map((p) => (
                    <tr key={p.providerId} className="border-b border-line">
                      <td className="py-3 pr-4">
                        <ProviderChip id={p.providerId} name={providerName(state, p.providerId)} />
                      </td>
                      <td className="py-3 pr-4 text-right">{p.steps}</td>
                      <td className="py-3 pr-4 text-right">
                        {p.microsPerStep !== null ? `${usdc(p.microsPerStep)} USDC` : "–"}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">{usdc(p.micros)} USDC</td>
                      <td className="py-3">
                        <span className="flex items-center gap-2 text-ink-2">
                          <StatusIcon tone="good" />
                          Steps in the accepted model
                        </span>
                      </td>
                    </tr>
                  ))}
                  {v.zeroPaid.map((z) => (
                    <tr key={z.providerId} className="border-b border-line">
                      <td className="py-3 pr-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <ProviderChip id={z.providerId} name={providerName(state, z.providerId)} />
                          {state.providers[z.providerId]?.kind === "INJECTED_FAULT" && <TruthBadge truth="INJECTED_FAULT" />}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        0 <span className="text-muted">({z.rejectedSteps} rejected)</span>
                      </td>
                      <td className="py-3 pr-4 text-right">–</td>
                      <td className="py-3 pr-4 text-right font-semibold">0.00 USDC</td>
                      <td className="py-3">
                        <span className="flex items-center gap-2 text-ink-2">
                          <StatusIcon tone="critical" />
                          {z.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-3 pr-4 text-ink-2">Refund to client</td>
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4 text-right font-semibold">{usdc(v.refundMicros)} USDC</td>
                    <td className="py-3 text-ink-2">Budget not earned by accepted work</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink">
              <StatusIcon tone={v.balanced ? "good" : "critical"} />
              <span className="tabular">
                {v.payees.map((p) => `${p.providerId} ${usdc(p.micros)}`).join(" + ")} + refund {usdc(v.refundMicros)}{" "}
                {v.balanced ? "=" : "≠"} budget {usdc(v.budgetMicros)}
              </span>
              <span className="text-ink-2">
                {v.balanced ? "The contract enforces this sum." : "Does not add up. The contract would refuse this verdict."}
              </span>
            </p>
          </Panel>
        </>
      )}

      <Panel title="On-chain record" subtitle="Coarse states only. Fine-grained job events stay off-chain.">
        {state.chain.length === 0 ? (
          <EmptyState title="No transactions yet">The escrow transaction appears when the client funds the job.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {state.chain.map((t) => (
              <li key={t.tx_hash}>
                <TxStatus label={txLabel[t.kind] ?? t.kind} status={t.status} hash={t.tx_hash} href={t.explorer_url} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">Unaudited contract on {localChain ? "a local chain" : "a testnet"}. It must not hold real funds.</p>
      </Panel>
    </div>
  );
}
