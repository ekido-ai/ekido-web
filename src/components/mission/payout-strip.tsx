import Link from "next/link";
import type { DashboardState } from "@/lib/events/reduce";
import { shortProviderName } from "@/lib/events/derive";
import { settlementView, usdc } from "@/lib/events/views";
import { ProviderChip } from "@/components/ui/provider-chip";
import { StatusIcon } from "@/components/ui/status";

function Amount({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-ink-2">{children}</div>
      <div className="tabular mt-0.5 text-2xl font-semibold text-ink">{label}</div>
    </div>
  );
}

/** The end of the story, on the main screen: who got paid, who got nothing, and what went back. */
export function PayoutStrip({ state }: { state: DashboardState }) {
  const view = settlementView(state);
  if (!view) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        {view.payees.map((p) => (
          <Amount key={p.providerId} label={`${usdc(p.micros)} USDC`}>
            <ProviderChip id={p.providerId} name={`${shortProviderName(state, p.providerId)}, ${p.steps} accepted steps`} />
          </Amount>
        ))}
        {view.zeroPaid.map((z) => (
          <Amount key={z.providerId} label="0.00 USDC">
            <ProviderChip id={z.providerId} name={`${shortProviderName(state, z.providerId)}, ${z.rejectedSteps} steps rejected`} />
          </Amount>
        ))}
        <Amount label={`${usdc(view.refundMicros)} USDC`}>Refund to client</Amount>
        <div className="ml-auto flex items-center gap-2 text-sm text-ink-2">
          <StatusIcon tone={view.balanced ? "good" : "critical"} />
          {view.balanced ? `Adds up to the ${usdc(view.budgetMicros)} USDC budget.` : "Doesn't add up to the budget."}{" "}
          <Link href="/settlement" className="underline hover:text-ink">
            Details
          </Link>
          <Link href="/verify" className="underline hover:text-ink">
            Verify
          </Link>
        </div>
      </div>
    </div>
  );
}
