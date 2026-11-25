"use client";

import { useTranslations } from "next-intl";
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

// Labels are in messages (demo.settlement.tx.<kind>); an unknown kind shows as itself.
const TX_KINDS = new Set(["createJob", "markActive", "anchorEvent", "submitAttestation", "finalize", "withdraw"]);

const PHASE_TONE: Record<string, Tone> = { SETTLED: "good", COMPLETED: "warning", DISPUTED: "serious", REFUNDED: "neutral" };
function phase(state: string | null): { tone: Tone; key: string } {
  return state && PHASE_TONE[state] ? { tone: PHASE_TONE[state], key: state } : { tone: "idle", key: "none" };
}

export default function SettlementPage() {
  const t = useTranslations("demo.settlement");
  const { state, provenance } = useDashboard();
  const v = settlementView(state);
  const ph = phase(state.jobState);
  const localChain = state.chain.some((x) => x.chain === "anvil");
  const partLabel = (p: { kind?: string; label: string }) => (p.kind === "refund" ? t("refund") : p.label);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {localChain && <TruthBadge truth="LOCAL_CHAIN" />}
            <ReceiptDownload state={state} source={provenance} />
            <StatusPill tone={ph.tone} size="lg">
              {t(`phase.${ph.key}`)}
            </StatusPill>
          </div>
        }
      >
        {t("lead")}
      </PageHeader>

      {!v ? (
        <EmptyState title={t("emptyTitle")} action={<EmptyActions />}>
          {t("empty")}
        </EmptyState>
      ) : (
        <>
          <Panel title={t("whereTitle", { budget: usdc(v.budgetMicros) })} subtitle={t(localChain ? "testUsdcLocal" : "testUsdc")}>
            {/* Tall segmented bar: one whole split into parts, with a legend. */}
            <div
              className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md"
              role="img"
              aria-label={v.parts.map((p) => `${partLabel(p)} ${usdc(p.micros)} USDC`).join(", ")}
            >
              {v.parts.map((p) => (
                <div
                  key={p.key}
                  className={cx("h-full", p.providerId ? providerSwatch(p.providerId) : "bg-surface-3")}
                  style={{ width: `${p.frac * 100}%` }}
                  title={`${partLabel(p)}: ${usdc(p.micros)} USDC (${Math.round(p.frac * 100)}%)`}
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
                  <span className="text-ink-2">{partLabel(p)}</span>
                  <span className="tabular font-semibold text-ink">{usdc(p.micros)} USDC</span>
                  <span className="tabular text-sm text-muted">{Math.round(p.frac * 100)}%</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("whoTitle")}>
            <ul className="divide-y divide-line text-sm sm:hidden">
              {v.payees.map((p) => (
                <li key={p.providerId} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProviderChip id={p.providerId} name={providerName(state, p.providerId)} />
                    <strong className="tabular">{usdc(p.micros)} USDC</strong>
                  </div>
                  <p className="text-ink-2">{p.microsPerStep !== null ? t("acceptedRate", { steps: p.steps, rate: usdc(p.microsPerStep) }) : t("acceptedNoRate", { steps: p.steps })}</p>
                </li>
              ))}
              {v.zeroPaid.map((z) => (
                <li key={z.providerId} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ProviderChip id={z.providerId} name={providerName(state, z.providerId)} />
                    <strong>0.00 USDC</strong>
                  </div>
                  <p className="text-ink-2">{t("zeroLine", { rejected: z.rejectedSteps, reason: z.reason })}</p>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 py-3"><span>{t("refund")}</span><strong>{usdc(v.refundMicros)} USDC</strong></li>
            </ul>
            <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
              <table className="tabular w-full min-w-[640px] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-medium">{t("colWho")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("colSteps")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("colRate")}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t("colPaid")}</th>
                    <th className="py-2 font-medium">{t("colWhy")}</th>
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
                          {t("whyAccepted")}
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
                        0 <span className="text-muted">{t("rejected", { rejected: z.rejectedSteps })}</span>
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
                    <td className="py-3 pr-4 text-ink-2">{t("refund")}</td>
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4 text-right font-semibold">{usdc(v.refundMicros)} USDC</td>
                    <td className="py-3 text-ink-2">{t("whyRefund")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink">
              <StatusIcon tone={v.balanced ? "good" : "critical"} />
              <span className="tabular">
                {t("sum", {
                  parts: v.payees.map((p) => `${p.providerId} ${usdc(p.micros)}`).join(" + "),
                  refund: usdc(v.refundMicros),
                  op: v.balanced ? "=" : "≠",
                  budget: usdc(v.budgetMicros),
                })}
              </span>
              <span className="text-ink-2">
                {t(v.balanced ? "balanced" : "unbalanced")}
              </span>
            </p>
          </Panel>
        </>
      )}

      <Panel title={t("chainTitle")} subtitle={t("chainSubtitle")}>
        {state.chain.length === 0 ? (
          <EmptyState title={t("noTxTitle")}>{t("noTx")}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {state.chain.map((tx) => (
              <li key={tx.tx_hash}>
                <TxStatus label={TX_KINDS.has(tx.kind) ? t(`tx.${tx.kind}`) : tx.kind} status={tx.status} hash={tx.tx_hash} href={tx.explorer_url} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">{t(localChain ? "unauditedLocal" : "unaudited")}</p>
      </Panel>
    </div>
  );
}
