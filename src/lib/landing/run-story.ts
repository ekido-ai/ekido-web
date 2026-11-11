import realJson from "../../../replay/recordings/real-run-2026-11-04.json";

/*
 * The landing page's story, derived from the real 4 Nov recording at build time,
 * so the chart and the ticker can never drift from what actually happened.
 * Times are seconds since the first event (same clock as the dashboard).
 */

interface Ev {
  ts: string;
  type: string;
  data: Record<string, unknown>;
}

const events = (realJson as { events: Ev[] }).events;
const providers = (realJson as { providers: { provider_id: string; name: string }[] }).providers;
const t0 = Date.parse(events[0].ts);
const at = (e: Ev) => (Date.parse(e.ts) - t0) / 1000;

/** Short names only: "Provider B (capped 768 MiB)" → "Provider B". */
const nameOf = new Map(providers.map((p) => [p.provider_id, p.name.replace(/\s*\(.*\)$/, "")]));

export interface Segment {
  provider: string;
  /** [step, loss] */
  points: [number, number][];
  /** Training on this provider ended badly: "killed" or "rejected". null = finished fine. */
  outcome: "killed" | "rejected" | null;
}

function buildSegments(): Segment[] {
  const segs: Segment[] = [];
  for (const e of events) {
    if (e.type !== "training.progress") continue;
    const name = nameOf.get(e.data.provider_id as string) ?? "Unknown";
    const last = segs[segs.length - 1];
    const pt: [number, number] = [e.data.step as number, Math.round((e.data.loss as number) * 1000) / 1000];
    if (!last || last.provider !== name) segs.push({ provider: name, points: [pt], outcome: null });
    else last.points.push(pt);
  }
  // The recording says how each run ended: A was killed, P's checkpoint was rejected.
  const killed = events.find((e) => e.type === "failure.detected");
  const killedName = killed ? nameOf.get(killed.data.provider_id as string) : undefined;
  for (const s of segs) {
    if (s.provider === killedName) s.outcome = "killed";
  }
  const rejectedIdx = segs.findIndex((s) => s.provider === "Provider P");
  if (rejectedIdx >= 0) segs[rejectedIdx].outcome = "rejected";
  return segs;
}

export const segments = buildSegments();

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function buildTicker(): { t: string; text: string; tone: "bad" | "good" | "info" }[] {
  const out: { t: string; text: string; tone: "bad" | "good" | "info" }[] = [];
  let resumed = 0;
  for (const e of events) {
    const t = clock(at(e));
    const d = e.data;
    if (e.type === "job.state_changed" && d.to === "RUNNING" && d.from === "ASSIGNED") out.push({ t, text: "Training starts on Provider A", tone: "info" });
    if (e.type === "fault.injected") out.push({ t, text: "We pull the plug on Provider A", tone: "bad" });
    if (e.type === "failure.detected") out.push({ t, text: `Failure noticed at step ${d.last_step}`, tone: "bad" });
    if (e.type === "checkpoint.accepted") out.push({ t, text: `Checkpoint at step ${d.step} accepted by both verifiers`, tone: "good" });
    if (e.type === "job.state_changed" && d.reason === "Training resumed") {
      resumed += 1;
      out.push({ t, text: `Training resumes on ${resumed === 1 ? "Provider P" : "Provider B"}`, tone: "good" });
    }
    if (e.type === "checkpoint.rejected") out.push({ t, text: `Provider P's checkpoint fails the quality test, refused`, tone: "bad" });
    if (e.type === "job.state_changed" && d.to === "COMPLETED") out.push({ t, text: "Final model accepted", tone: "good" });
    if (e.type === "job.state_changed" && d.to === "SETTLED") out.push({ t, text: "Escrow pays out on-chain", tone: "good" });
  }
  return out;
}

export const ticker = buildTicker();
