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

export type StageKey =
  | "none" | "open" | "assigned" | "running" | "rejected" | "failedCause" | "validating" | "completed" | "settled" | "disputed"
  | "failed" | "refunded" | "cancelled";

export interface Stage {
  tone: Tone;
  /** English, as before; `key` and `values` are the same line for the translation layer (messages: demo.stage). */
  headline: string;
  detail: string | null;
  key: StageKey;
  /** `name` is a provider name, or null for "a provider"; `cause` is a failure cause code. */
  values?: { name?: string | null; cause?: string };
  /** Set when the detail is our own words; otherwise `detail` is the coordinator's reason, shown as it came. */
  detailKey?: "waiting" | "step";
  detailValues?: { step: number; total: number };
}

/** Plain-language summary of the current moment: what a judge should read first. */
export function describeStage(s: DashboardState): Stage {
  const shortName = (id: string | null) => (id ? (s.providers[id]?.name ?? `Provider ${id}`).replace(/ \(.*\)$/, "") : null);
  const name = (id: string | null) => shortName(id) ?? "a provider";
  const lastRecovery = s.recovery.at(-1);
  const lastFailure = s.failures.at(-1);
  const last = s.progress.at(-1);
  const reason = { detail: s.jobStateReason };

  switch (s.jobState) {
    case null:
      return { tone: "idle", headline: "No job yet", detail: "Waiting for the first event", key: "none", detailKey: "waiting" };
    case "OPEN":
      return { tone: "neutral", headline: "Job created, waiting for funds in escrow", key: "open", ...reason };
    case "ASSIGNED":
      return { tone: "active", headline: "Provider chosen, starting up", key: "assigned", ...reason };
    case "RUNNING": {
      // The progress bar already shows the step; say why we're here instead.
      const step = !s.jobStateReason && last ? { detailKey: "step" as const, detailValues: { step: last.step, total: last.total_steps } } : {};
      return {
        tone: "active",
        headline: `Training on ${name(s.activeProviderId)}`,
        detail: s.jobStateReason ?? (last ? `Step ${last.step} of ${last.total_steps}` : null),
        key: "running",
        values: { name: shortName(s.activeProviderId) },
        ...step,
      };
    }
    case "RECOVERING": {
      const rejected = lastFailure?.cause === "QUALITY_REJECTED";
      const who = lastFailure?.provider_id ?? null;
      return {
        tone: "warning",
        headline: rejected
          ? `${name(who)}'s result was rejected. Rolling back`
          : `${name(who)} ${CAUSE_TEXT[lastFailure?.cause ?? ""] ?? "failed"}. Recovering`,
        detail: lastRecovery?.detail ?? s.jobStateReason,
        key: rejected ? "rejected" : "failedCause",
        values: { name: shortName(who), cause: lastFailure?.cause ?? "" },
      };
    }
    case "VALIDATING":
      return { tone: "active", headline: "Checking the final model", key: "validating", ...reason };
    case "COMPLETED":
      return { tone: "good", headline: "Result accepted. Dispute window open", key: "completed", ...reason };
    case "SETTLED":
      return { tone: "good", headline: "Paid for accepted work only", key: "settled", ...reason };
    case "DISPUTED":
      return { tone: "serious", headline: "The client disputed the result", key: "disputed", ...reason };
    case "FAILED":
      return { tone: "critical", headline: "Job failed", key: "failed", ...reason };
    case "REFUNDED":
      return { tone: "neutral", headline: "Client refunded", key: "refunded", ...reason };
    case "CANCELLED":
      return { tone: "neutral", headline: "Job cancelled", key: "cancelled", ...reason };
  }
}

/** The cause codes that have their own words (messages: demo.stage.cause.<CODE>); others read as "failed". */
export const STAGE_CAUSES = new Set(Object.keys(CAUSE_TEXT));

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The stage in the reader's language, given `useTranslations("demo.stage")`. */
export function localizeStage(stage: Stage, t: Translate): { headline: string; detail: string | null } {
  const name = stage.values?.name ?? t("someProvider");
  const cause = stage.values?.cause && STAGE_CAUSES.has(stage.values.cause) ? t(`cause.${stage.values.cause}`) : t("causeFallback");
  const headline = t(`headline.${stage.key}`, { name, cause });
  const detail = stage.detailKey ? t(`detail.${stage.detailKey}`, stage.detailValues ?? {}) : stage.detail;
  return { headline, detail };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
