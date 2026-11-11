"use client";

import { useMemo } from "react";
import { Minus } from "lucide-react";
import type { DashboardState } from "@/lib/events/reduce";
import { journey, stepTimes, type JourneyStep, type StepKey } from "@/lib/events/journey";
import { momentsOf } from "@/lib/events/moments";
import { usePlayer, usePlayerSnapshot } from "@/lib/events/source-context";
import { formatClock } from "@/lib/events/describe";
import { StatusIcon, type Tone } from "@/components/ui/status";
import { cx } from "@/components/ui/cx";

/** A lost GPU and refused work are bad news even when they "happened" as planned. */
const BAD: StepKey[] = ["lost", "refused"];

function toneOf(step: JourneyStep): Tone {
  if (step.status === "done") return BAD.includes(step.key) ? "critical" : "good";
  if (step.status === "active") return "active";
  return "idle";
}

function StepBody({ step, at }: { step: JourneyStep; at: number | null }) {
  const dim = step.status === "waiting" || step.status === "skipped";
  return (
    <>
      <span className="flex items-start gap-2">
        {step.status === "skipped" ? (
          <Minus className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        ) : (
          <StatusIcon tone={toneOf(step)} className="mt-0.5 size-5" />
        )}
        <span className={cx("min-w-0 flex-1 text-base font-semibold leading-snug", dim ? "text-ink-2" : "text-ink")}>{step.label}</span>
        {at !== null && <span className={cx("tabular mt-0.5 shrink-0 text-xs", step.atMs === null ? "text-muted/70" : "text-muted")}>{formatClock(at)}</span>}
      </span>
      <span className={cx("mt-0.5 block truncate pl-7 text-sm", step.status === "active" ? "text-ink" : "text-muted")}>{step.detail}</span>
      <span className="sr-only">
        {step.status === "done" ? "happened" : step.status === "active" ? "happening now" : step.status === "skipped" ? "didn't happen" : "not yet"}
      </span>
    </>
  );
}

const cell = (step: JourneyStep) =>
  cx(
    "relative min-w-0 rounded-lg border px-3 py-2 text-left",
    step.status === "active" ? "border-ink-2 bg-surface-2" : "border-line bg-surface",
    step.status === "done" && BAD.includes(step.key) && "border-critical/50",
  );

/**
 * The run's story at a glance. In a recording every step is a button that jumps to that moment,
 * including ones that haven't played yet. Live, the steps only show what has really happened.
 */
export function JourneyStrip({ state, replay, stale = false }: { state: DashboardState; replay: boolean; stale?: boolean }) {
  // Disconnected: nothing is "happening now" as far as we know, so no spinner.
  const steps = journey(state).map((s) => (stale && s.status === "active" ? { ...s, status: "waiting" as const, detail: `Last known: ${s.detail}` } : s));
  return (
    <ol aria-label="How far the run has got" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {replay ? <ReplaySteps steps={steps} /> : steps.map((s) => (
        <li key={s.key} className={cell(s)} aria-current={s.status === "active" ? "step" : undefined}>
          <StepBody step={s} at={s.atMs} />
        </li>
      ))}
    </ol>
  );
}

function ReplaySteps({ steps }: { steps: JourneyStep[] }) {
  const player = usePlayer();
  const snap = usePlayerSnapshot();
  // Jump targets come from the whole recording, so steps that haven't played yet still work.
  const targets = useMemo(() => {
    const all = momentsOf(player.recording.events);
    const t = stepTimes(all);
    const firstTs = player.recording.events.length ? Date.parse(player.recording.events[0].ts) : 0;
    const train = player.recording.events.find((e) => e.type === "training.progress");
    return { ...Object.fromEntries(Object.entries(t).map(([k, m]) => [k, m!.offsetMs])), train: train ? Date.parse(train.ts) - firstTs : 0 } as Partial<Record<StepKey, number>>;
  }, [player]);

  return (
    <>
      {steps.map((step) => {
        const at = targets[step.key];
        // In a recording, "Press Kill" makes no sense: the step is simply further along.
        const s = step.status === "waiting" && at !== undefined ? { ...step, detail: "Later in the recording" } : step;
        if (at === undefined)
          return (
            <li key={s.key} className={cell(s)}>
              <StepBody step={s} at={null} />
            </li>
          );
        return (
          <li key={s.key} className="min-w-0">
            <button
              type="button"
              onClick={() => {
                player.seek(Math.max(0, at - 1500));
                if (!snap.playing) player.play();
              }}
              aria-current={s.status === "active" ? "step" : undefined}
              title={`Jump to ${s.label.toLowerCase()} at ${formatClock(at)} in the recording`}
              className={cx(cell(s), "press w-full transition-colors hover:border-line-strong hover:bg-surface-2")}
            >
              <StepBody step={s} at={at} />
            </button>
          </li>
        );
      })}
    </>
  );
}
