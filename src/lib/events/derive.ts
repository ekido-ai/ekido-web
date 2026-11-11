import type { Tone } from "@/components/ui/status";
import type { DashboardState } from "./reduce";
import type { RecoveryStage } from "./types";

/** Milliseconds since the first event, as m:ss. */
export function sinceStart(s: DashboardState, ts: string): string {
  const t0 = s.log[0] ? Date.parse(s.log[0].ts) : Date.parse(ts);
  const total = Math.max(0, Math.floor((Date.parse(ts) - t0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function providerName(s: DashboardState, id: string | null | undefined): string {
  if (!id) return "a provider";
  return s.providers[id]?.name ?? `Provider ${id}`;
}

/** "Provider P (injected fault)" reads badly mid-sentence, and the badge already says it. */
export function shortProviderName(s: DashboardState, id: string | null | undefined): string {
  return providerName(s, id).replace(/ \(.*\)$/, "");
}

/** Who has had work refused. Their numbers shouldn't headline the screen. */
export function rejectedProviders(s: DashboardState): Set<string> {
  return new Set(s.checkpoints.filter((c) => c.state === "REJECTED").map((c) => c.provider_id));
}

/** Where training really stands: during a recovery, that's the step it will resume from. */
export function resumePoint(s: DashboardState): number | null {
  if (s.jobState !== "RECOVERING") return null;
  const latest = recoveries(s).at(-1);
  return latest?.status === "in_progress" ? latest.checkpointStep : null;
}

// ---------------------------------------------------------------- loss chart

export interface LossSegment {
  attempt: number;
  providerId: string;
  points: { step: number; loss: number }[];
  /** A checkpoint from this segment was rejected by Quality Guard. */
  rejected: boolean;
  /** This segment is the one currently training. */
  live: boolean;
}

/** One segment per attempt. Segments overlap in steps after a rollback, which is the point. */
export function lossSegments(s: DashboardState): LossSegment[] {
  const byAttempt = new Map<number, LossSegment>();
  for (const p of s.progress) {
    let seg = byAttempt.get(p.attempt);
    if (!seg) {
      seg = { attempt: p.attempt, providerId: p.provider_id, points: [], rejected: false, live: false };
      byAttempt.set(p.attempt, seg);
    }
    seg.points.push({ step: p.step, loss: p.loss });
  }
  const segs = [...byAttempt.values()].sort((a, b) => a.attempt - b.attempt);
  for (const seg of segs) {
    const first = seg.points[0]?.step ?? 0;
    const last = seg.points.at(-1)?.step ?? 0;
    seg.rejected = s.checkpoints.some(
      (c) => c.provider_id === seg.providerId && c.state === "REJECTED" && c.step > first && c.step <= last,
    );
  }
  const last = segs.at(-1);
  if (last && s.jobState === "RUNNING") last.live = true;
  return segs;
}

export interface CheckpointMark {
  id: string;
  step: number;
  loss: number;
  providerId: string;
  state: DashboardState["checkpoints"][number]["state"];
}

/** Checkpoints placed on their segment's loss line. */
export function checkpointMarks(s: DashboardState, segs: LossSegment[]): CheckpointMark[] {
  const out: CheckpointMark[] = [];
  for (const c of s.checkpoints) {
    const seg = [...segs].reverse().find(
      (g) => g.providerId === c.provider_id && g.points.some((p) => Math.abs(p.step - c.step) <= 3),
    );
    if (!seg) continue;
    const near = seg.points.reduce((a, b) => (Math.abs(b.step - c.step) < Math.abs(a.step - c.step) ? b : a));
    out.push({ id: c.checkpoint_id, step: c.step, loss: near.loss, providerId: c.provider_id, state: c.state });
  }
  return out;
}

// ---------------------------------------------------------- recovery feed

const stageText: Record<RecoveryStage, string> = {
  DETECTED: "Failure detected",
  FENCED: "Old worker fenced off",
  SELECT_CHECKPOINT: "Checkpoint chosen",
  HANDOVER_EVAL: "Checking the handover checkpoint",
  FIND_CANDIDATES: "Looking for a replacement",
  COMPILE: "Adapting the job for candidates",
  PROBE: "Measuring real memory on the candidate",
  ASSIGN: "Replacement assigned",
  RESTORE: "State restored",
  CANARY_CHECK: "Restore checked: same loss on a fixed test batch",
  RESUMED: "Training resumed",
  ABORT: "Recovery gave up",
};

export interface FeedEntry {
  id: string;
  ts: string;
  time: string;
  tone: Tone;
  title: string;
  detail: string | null;
  injected: boolean;
}

/** Failures, recovery steps and compile decisions, in time order. */
export function recoveryFeed(s: DashboardState): FeedEntry[] {
  const entries: FeedEntry[] = [];

  s.failures.forEach((f, i) => {
    const who = shortProviderName(s, f.provider_id);
    entries.push({
      id: `f${i}`,
      ts: f.ts,
      time: sinceStart(s, f.ts),
      tone: f.cause === "QUALITY_REJECTED" ? "critical" : "serious",
      title: f.cause === "QUALITY_REJECTED" ? `${who}'s result rejected` : `${who} stopped`,
      detail: f.detail,
      injected: f.injected,
    });
  });

  const recovering = s.jobState === "RECOVERING";
  s.recovery.forEach((r, i) => {
    if (r.stage === "DETECTED") return; // the failure entry already says this
    const isLatest = i === s.recovery.length - 1;
    entries.push({
      id: `r${i}`,
      ts: r.ts,
      time: sinceStart(s, r.ts),
      tone: r.stage === "ABORT" ? "critical" : isLatest && recovering ? "active" : "good",
      title: stageText[r.stage],
      detail: r.detail,
      injected: false,
    });
  });

  s.compile.forEach((c, i) => {
    const who = shortProviderName(s, c.provider_id);
    const cfg = c.to ? `micro-batch ${c.to.micro_batch} × ${c.to.accum} accumulation, ${c.to.amp}` : null;
    entries.push({
      id: `c${i}`,
      ts: c.ts,
      time: sinceStart(s, c.ts),
      tone: c.verdict === "accepted" ? "good" : "critical",
      title: c.verdict === "accepted" ? `${who} can run it${cfg ? `: ${cfg}` : ""}` : `${who} can't run it`,
      detail: c.reason,
      injected: false,
    });
  });

  // Stable sort keeps same-timestamp entries in a sensible order (failure, recovery, compile).
  return entries.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

// ------------------------------------------------- recoveries, grouped

export interface RecoveryPhase {
  label: string;
  /** null while the phase hasn't finished. */
  ms: number | null;
}

export interface RecoveryView {
  attempt: number;
  status: "in_progress" | "resumed" | "aborted";
  cause: DashboardState["failures"][number]["cause"] | null;
  injected: boolean;
  failedProviderId: string | null;
  headline: string;
  startedTs: string;
  /** Failure → first resumed step (or → now while in progress). */
  elapsedMs: number;
  checkpointStep: number | null;
  lostSteps: number | null;
  replacementId: string | null;
  phases: RecoveryPhase[];
  entries: FeedEntry[];
}

/**
 * One view per recovery attempt, oldest first. Phase boundaries follow plan.md's recovery
 * state diagram: failure → FENCED → SELECT_CHECKPOINT → ASSIGN → RESUMED.
 */
export function recoveries(s: DashboardState): RecoveryView[] {
  const attempts = [...new Set(s.recovery.map((r) => r.attempt))].sort((a, b) => a - b);
  const nowMs = s.now ? Date.parse(s.now) : 0;

  return attempts.map((attempt) => {
    const steps = s.recovery.filter((r) => r.attempt === attempt);
    const first = (stage: string) => steps.find((r) => r.stage === stage);
    const detected = first("DETECTED") ?? steps[0];
    const detectedMs = Date.parse(detected.ts);

    // The failure that triggered this attempt: same provider, at or before detection.
    const failure =
      [...s.failures]
        .reverse()
        .find(
          (f) =>
            Date.parse(f.ts) <= detectedMs &&
            (!detected.provider_id || f.provider_id === detected.provider_id),
        ) ?? null;
    const startMs = failure ? Date.parse(failure.ts) : detectedMs;
    const failedId = failure?.provider_id ?? detected.provider_id ?? null;

    const at = (stage: string) => {
      const r = first(stage);
      return r ? Date.parse(r.ts) : null;
    };
    const fenced = at("FENCED");
    const ckpt = at("SELECT_CHECKPOINT");
    const assign = at("ASSIGN");
    const resumed = at("RESUMED");
    const aborted = first("ABORT");
    const span = (a: number | null, b: number | null) => (a !== null && b !== null ? b - a : null);

    const select = first("SELECT_CHECKPOINT");
    const checkpointStep = select?.checkpoint_id
      ? (s.checkpoints.find((c) => c.checkpoint_id === select.checkpoint_id)?.step ?? null)
      : null;

    const status = resumed !== null ? "resumed" : aborted ? "aborted" : "in_progress";
    const who = shortProviderName(s, failedId);
    const headline =
      failure?.cause === "QUALITY_REJECTED" ? `${who}'s result was rejected` : `${who} stopped`;

    // Entries for this attempt only. The latest step is "active" only while this attempt runs.
    const ids = new Set<string>();
    s.recovery.forEach((r, i) => r.attempt === attempt && ids.add(`r${i}`));
    s.compile.forEach((c, i) => c.attempt === attempt && ids.add(`c${i}`));
    if (failure) ids.add(`f${s.failures.indexOf(failure)}`);
    const entries = recoveryFeed(s)
      .filter((e) => ids.has(e.id))
      .map((e) => (e.tone === "active" && status !== "in_progress" ? { ...e, tone: "good" as Tone } : e));

    return {
      attempt,
      status,
      cause: failure?.cause ?? null,
      injected: failure?.injected ?? false,
      failedProviderId: failedId,
      headline,
      startedTs: new Date(startMs).toISOString(),
      elapsedMs: (resumed ?? (aborted ? Date.parse(aborted.ts) : nowMs)) - startMs,
      checkpointStep,
      lostSteps: select?.lost_steps ?? null,
      replacementId: first("ASSIGN")?.provider_id ?? null,
      phases: [
        { label: "Detect and fence", ms: span(startMs, fenced) },
        { label: "Pick checkpoint", ms: span(fenced, ckpt) },
        { label: "Find replacement", ms: span(ckpt, assign) },
        { label: "Restore and check", ms: span(assign, resumed) },
      ],
      entries,
    };
  });
}

// ------------------------------------------------------------- providers

/** Telemetry older than this (in event time) is treated as missing. */
export const TELEMETRY_STALE_MS = 6000;

export function freshTelemetry(s: DashboardState, providerId: string) {
  const t = s.telemetry[providerId];
  if (!t || !s.now) return null;
  return Date.parse(s.now) - Date.parse(t.ts) <= TELEMETRY_STALE_MS ? t : null;
}

export type ProviderNote = { tone: Tone; text: string };

/** What happened to this provider in this job, in a few words. */
export function providerNotes(s: DashboardState, id: string): ProviderNote[] {
  const notes: ProviderNote[] = [];
  const failure = [...s.failures].reverse().find((f) => f.provider_id === id);
  if (failure?.cause === "QUALITY_REJECTED") notes.push({ tone: "critical", text: "Result rejected · earns 0" });
  else if (failure) notes.push({ tone: "serious", text: `Stopped at ${sinceStart(s, failure.ts)}` });
  const compile = [...s.compile].reverse().find((c) => c.provider_id === id);
  if (compile?.verdict === "rejected") notes.push({ tone: "critical", text: `Can't run this job: ${compile.reason}` });
  if (compile?.verdict === "accepted" && compile.to && compile.from && compile.to.micro_batch !== compile.from.micro_batch) {
    notes.push({
      tone: "good",
      text: `Adapted: micro-batch ${compile.from.micro_batch} → ${compile.to.micro_batch}, accumulation ${compile.from.accum} → ${compile.to.accum}`,
    });
  }
  return notes;
}
