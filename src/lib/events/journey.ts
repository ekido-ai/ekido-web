import type { DashboardState } from "./reduce";
import { shortProviderName } from "./derive";
import { momentsOf, type Moment } from "./moments";

/*
 * The run as a story of six steps, so someone across the room can tell how far it has got:
 * training, a device lost, training resumed, bad work refused, final check, paid.
 * Pure: the same steps for replay and live, built only from events that really arrived.
 */

export type StepKey = "train" | "lost" | "resumed" | "refused" | "checked" | "paid";
export type StepStatus = "done" | "active" | "waiting" | "skipped";

export interface JourneyStep {
  key: StepKey;
  label: string;
  status: StepStatus;
  /** One short line under the label, e.g. "Provider A". The time is shown from atMs. */
  detail: string;
  /** Offset from the first event, on the replay player's clock. Null until it happened. */
  atMs: number | null;
}

type Timed = Moment & { offsetMs: number };

/** Offset (ms from the first event) of each step, from a list of key moments. */
export function stepTimes(moments: Timed[]): Partial<Record<StepKey, Timed>> {
  const lost = moments.find((m) => m.kind === "lost");
  const out: Partial<Record<StepKey, Timed>> = {};
  if (lost) out.lost = lost;
  // "Resumed" is the first comeback after the GPU was lost, not after a refusal.
  const resumed = lost ? moments.find((m) => m.kind === "resumed" && m.offsetMs >= lost.offsetMs) : undefined;
  if (resumed) out.resumed = resumed;
  const refused = moments.find((m) => m.kind === "refused");
  if (refused) out.refused = refused;
  const done = moments.find((m) => m.kind === "done");
  if (done) out.checked = done;
  const paid = moments.find((m) => m.kind === "paid");
  if (paid) out.paid = paid;
  return out;
}

const FINISHED = new Set(["COMPLETED", "SETTLED", "REFUNDED", "FAILED", "CANCELLED", "DISPUTED"]);

export function journey(s: DashboardState): JourneyStep[] {
  const t0 = s.log.length ? Date.parse(s.log[0].ts) : 0;
  const times = stepTimes(momentsOf(s.log));
  const firstProgress = s.progress[0];
  const finished = s.jobState !== null && FINISHED.has(s.jobState);
  const who = (id: string | null | undefined) => shortProviderName(s, id);

  // The step the job is on now: the first one that hasn't happened, among those still possible.
  const train: JourneyStep = {
    key: "train",
    label: "Training",
    status: firstProgress ? "done" : s.jobState === "RUNNING" || s.jobState === "ASSIGNED" ? "active" : "waiting",
    detail: firstProgress ? `On ${who(firstProgress.provider_id)}` : s.jobState ? "Starting" : "No job yet",
    atMs: firstProgress ? Date.parse(firstProgress.ts) - t0 : null,
  };
  if (firstProgress && s.jobState === "RUNNING" && !times.lost) train.status = "active";

  const lost: JourneyStep = times.lost
    ? { key: "lost", label: "Device lost", status: "done", detail: who(times.lost.providerId), atMs: times.lost.offsetMs }
    : { key: "lost", label: "Device lost", status: finished ? "skipped" : "waiting", detail: finished ? "No failure this run" : "Press Kill to test", atMs: null };

  let resumed: JourneyStep;
  if (times.resumed) {
    resumed = { key: "resumed", label: "Resumed", status: "done", detail: "From a checkpoint", atMs: times.resumed.offsetMs };
  } else if (times.lost && s.jobState === "RECOVERING") {
    resumed = { key: "resumed", label: "Resumed", status: "active", detail: "Finding a replacement", atMs: null };
  } else {
    resumed = { key: "resumed", label: "Resumed", status: times.lost || !finished ? "waiting" : "skipped", detail: times.lost || !finished ? "After a failure" : "Not needed", atMs: null };
  }

  const refused: JourneyStep = times.refused
    ? { key: "refused", label: "Work refused", status: "done", detail: `${who(times.refused.providerId)}, not paid`, atMs: times.refused.offsetMs }
    : {
        key: "refused",
        label: "Work refused",
        status: finished ? "skipped" : "waiting",
        detail: finished ? "Nothing refused" : "If a check fails",
        atMs: null,
      };

  const checked: JourneyStep = times.checked
    ? { key: "checked", label: "Final check", status: "done", detail: "Verifiers accepted", atMs: times.checked.offsetMs }
    : {
        key: "checked",
        label: "Final check",
        status: s.jobState === "VALIDATING" ? "active" : s.jobState === "FAILED" || s.jobState === "CANCELLED" ? "skipped" : "waiting",
        detail: s.jobState === "VALIDATING" ? "Verifiers checking" : "Verifiers sign off",
        atMs: null,
      };

  const paid: JourneyStep = times.paid
    ? { key: "paid", label: "Paid", status: "done", detail: "Accepted work only", atMs: times.paid.offsetMs }
    : {
        key: "paid",
        label: "Paid",
        status: s.jobState === "COMPLETED" ? "active" : s.jobState === "REFUNDED" || s.jobState === "FAILED" || s.jobState === "CANCELLED" ? "skipped" : "waiting",
        detail: s.jobState === "COMPLETED" ? "Dispute window open" : "Escrow pays out",
        atMs: null,
      };

  return [train, lost, resumed, refused, checked, paid];
}
