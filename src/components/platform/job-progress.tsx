"use client";

import { useTranslations } from "next-intl";
import { StatusIcon, type Tone } from "@/components/ui/status";
import { rupees, type CustomerJob } from "@/lib/platform/train";

/*
 * P4 (ekido-ai/ekido-internal#45): the progress timeline of one customer job. It shows only what the Platform's
 * customer view carries, so no device is named, listed or counted: "moved" says only that the work carried on.
 * States: queued, training (with %), device moved, checking quality, passed, missed with refund, cancelled.
 */

type StepKey = "starting" | "training" | "checking" | "passed" | "refunded" | "cancelled";
type Step = { key: StepKey; tone: Tone; detail?: string };

const ORDER = ["starting", "training", "checking", "passed"] as const;

/** Each step's tone from the job's stage: done ones good, the current one active, the rest waiting. */
export function jobSteps(job: Pick<CustomerJob, "stage">): { key: StepKey; tone: Tone }[] {
  if (job.stage === "cancelled") return [{ key: "cancelled", tone: "critical" }];
  const ended = job.stage === "refunded";
  // A refund comes after the check, so everything up to checking is done.
  const at = ended ? ORDER.indexOf("checking") + 1 : ORDER.indexOf(job.stage as (typeof ORDER)[number]);
  const steps: { key: StepKey; tone: Tone }[] = ORDER.slice(0, ended ? 3 : 4).map((key, i) => ({
    key,
    tone: i < at || (key === "passed" && job.stage === "passed") ? "good" : i === at ? "active" : "idle",
  }));
  if (ended) steps.push({ key: "refunded", tone: "warning" });
  return steps;
}

export function JobProgress({ job }: { job: CustomerJob }) {
  const t = useTranslations("job");
  const percent = job.total_steps ? Math.min(100, Math.round((100 * job.steps_done) / job.total_steps)) : null;
  const pct = (n: number) => Math.round(n * 100);

  const steps: Step[] = jobSteps(job).map((s) => {
    if (s.key === "training" && job.total_steps) return { ...s, detail: t("steps", { done: job.steps_done, total: job.total_steps }) };
    if (s.key === "checking" && job.quality && job.quality.score === null) return { ...s, detail: t("qualityPending", { floor: pct(job.quality.floor) }) };
    if (s.key === "passed" && job.stage === "passed" && job.quality?.score != null)
      return { ...s, detail: t("qualityPassed", { score: pct(job.quality.score), floor: pct(job.quality.floor) }) };
    if (s.key === "refunded")
      return {
        ...s,
        detail: [
          job.quality?.score != null ? t("qualityMissed", { score: pct(job.quality.score), floor: pct(job.quality.floor) }) : t("stageLead.refunded"),
          job.payment ? t(`payment.${job.payment.status}`, { amount: rupees(job.payment.amount_paise) }) : null,
        ]
          .filter(Boolean)
          .join(" "),
      };
    if (s.key === "cancelled") return { ...s, detail: t("stageLead.cancelled") };
    return s;
  });

  return (
    <ol aria-label={t("timelineLabel")} className="relative space-y-5 border-l border-line-strong pl-6">
      {steps.map((s) => (
        <li key={s.key} className="relative" data-tone={s.tone} aria-current={s.tone === "active" ? "step" : undefined}>
          <span className="absolute -left-[33px] top-0.5 rounded-full bg-surface p-0.5">
            <StatusIcon tone={s.tone} />
          </span>
          <p className={s.tone === "idle" ? "font-medium text-muted" : "font-medium text-ink"}>{t(`stage.${s.key}`)}</p>
          {s.tone !== "idle" && s.detail && <p className="mt-0.5 text-sm text-ink-2">{s.detail}</p>}
          {s.key === "training" && s.tone === "active" && percent !== null && (
            <div className="mt-2 max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={t("percent", { n: percent })} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="tabular mt-1 text-xs text-ink-2">{t("percent", { n: percent })}</p>
            </div>
          )}
          {s.key === "training" && s.tone !== "idle" && job.moved_devices > 0 && (
            <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink">{t("moved", { n: job.moved_devices })}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
