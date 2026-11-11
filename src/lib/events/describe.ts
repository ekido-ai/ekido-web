import type { Tone } from "@/components/ui/status";
import type { DashboardState } from "./reduce";

const CAUSE_TEXT: Record<string, string> = {
  RUNTIME_EXIT: "lost its training process",
  OOM: "ran out of GPU memory",
  HEARTBEAT_LOSS: "stopped responding",
  DISCONNECT: "lost its connection",
  BAD_CHECKPOINT: "sent a checkpoint that failed its integrity check",
  START_FAILED: "couldn't start the job",
  DIVERGED: "diverged in training",
  NO_FINAL_CHECKPOINT: "finished without a final checkpoint",
};

/** Plain-language summary of the current moment: what a judge should read first. */
export function describeStage(s: DashboardState): { tone: Tone; headline: string; detail: string | null } {
  const name = (id: string | null) => (id ? (s.providers[id]?.name ?? `Provider ${id}`).replace(/ \(.*\)$/, "") : "a provider");
  const lastRecovery = s.recovery.at(-1);
  const lastFailure = s.failures.at(-1);
  const last = s.progress.at(-1);

  switch (s.jobState) {
    case null:
      return { tone: "idle", headline: "No job yet", detail: "Waiting for the first event" };
    case "OPEN":
      return { tone: "neutral", headline: "Job created, waiting for funds in escrow", detail: s.jobStateReason };
    case "ASSIGNED":
      return { tone: "active", headline: "Provider chosen, starting up", detail: s.jobStateReason };
    case "RUNNING":
      return {
        tone: "active",
        headline: `Training on ${name(s.activeProviderId)}`,
        // The progress bar already shows the step; say why we're here instead.
        detail: s.jobStateReason ?? (last ? `Step ${last.step} of ${last.total_steps}` : null),
      };
    case "RECOVERING":
      return {
        tone: "warning",
        headline: lastFailure?.cause === "QUALITY_REJECTED"
          ? `${name(lastFailure.provider_id)}'s result was rejected. Rolling back`
          : `${name(lastFailure?.provider_id ?? null)} ${CAUSE_TEXT[lastFailure?.cause ?? ""] ?? "failed"}. Recovering`,
        detail: lastRecovery?.detail ?? s.jobStateReason,
      };
    case "VALIDATING":
      return { tone: "active", headline: "Checking the final model", detail: s.jobStateReason };
    case "COMPLETED":
      return { tone: "good", headline: "Result accepted. Dispute window open", detail: s.jobStateReason };
    case "SETTLED":
      return { tone: "good", headline: "Paid for accepted work only", detail: s.jobStateReason };
    case "DISPUTED":
      return { tone: "serious", headline: "The client disputed the result", detail: s.jobStateReason };
    case "FAILED":
      return { tone: "critical", headline: "Job failed", detail: s.jobStateReason };
    case "REFUNDED":
      return { tone: "neutral", headline: "Client refunded", detail: s.jobStateReason };
    case "CANCELLED":
      return { tone: "neutral", headline: "Job cancelled", detail: s.jobStateReason };
  }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
