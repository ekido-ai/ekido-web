import type { AnyGpuEvent } from "./types";
import type { DashboardState } from "./reduce";
import { providerName } from "./derive";
import type { Tone } from "@/components/ui/status";

/*
 * "Key moments": the handful of events a viewer should not miss (a device lost, a result
 * refused, training back, done, paid). Used for the replay bar's markers and for toasts.
 * Pure, so it is shared by replay and live.
 */

export type MomentKind = "lost" | "refused" | "resumed" | "done" | "paid";

export interface Moment {
  kind: MomentKind;
  seq: number;
  providerId: string | null;
}

export function momentOf(e: AnyGpuEvent): Moment | null {
  if (e.type === "failure.detected") {
    return { kind: e.payload.cause === "QUALITY_REJECTED" ? "refused" : "lost", seq: e.seq, providerId: e.payload.provider_id };
  }
  if (e.type === "job.state_changed") {
    const { from, to } = e.payload;
    if (to === "RUNNING" && from === "RECOVERING") return { kind: "resumed", seq: e.seq, providerId: null };
    if (to === "COMPLETED") return { kind: "done", seq: e.seq, providerId: null };
    if (to === "SETTLED") return { kind: "paid", seq: e.seq, providerId: null };
  }
  return null;
}

/** Moments with their offset from the first event, on the same clock as ReplayPlayer. */
export function momentsOf(events: AnyGpuEvent[]): (Moment & { offsetMs: number })[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const t0 = sorted.length ? Date.parse(sorted[0].ts) : 0;
  const out: (Moment & { offsetMs: number })[] = [];
  for (const e of sorted) {
    const m = momentOf(e);
    if (m) out.push({ ...m, offsetMs: Date.parse(e.ts) - t0 });
  }
  return out;
}

export const momentLabel: Record<MomentKind, string> = {
  lost: "Device lost",
  refused: "Result refused",
  resumed: "Training resumed",
  done: "Final model accepted",
  paid: "Paid out",
};

export const momentTone: Record<MomentKind, Tone> = {
  lost: "critical",
  refused: "critical",
  resumed: "good",
  done: "good",
  paid: "good",
};

/** Plain-words title and detail for a toast, with provider names from the current state. */
export function momentText(m: Moment, s: DashboardState): { title: string; detail: string } {
  const who = providerName(s, m.providerId);
  switch (m.kind) {
    case "lost":
      return { title: `${who} went down`, detail: "Rolling back to the last good checkpoint and finding another device." };
    case "refused":
      return { title: `${who}'s result was refused`, detail: "It failed the quality test agreed before training, so it won't be paid." };
    case "resumed":
      return { title: `Training resumed on ${providerName(s, s.activeProviderId)}`, detail: "Picked up from the last accepted checkpoint." };
    case "done":
      return { title: "Final model accepted", detail: "The final checkpoint passed the configured verifier quorum." };
    case "paid":
      return { title: "Paid on-chain", detail: "Escrow released the money for accepted work and refunded the rest." };
  }
}
