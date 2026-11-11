import type {
  AnyGpuEvent,
  CheckpointState,
  EventPayloads,
  JobState,
} from "./types";

type P<T extends keyof EventPayloads> = EventPayloads[T];

export interface CheckpointView {
  checkpoint_id: string;
  provider_id: string;
  step: number;
  manifest_hash: string;
  state: CheckpointState;
  reason: string | null;
  ts: string;
}

export interface DashboardState {
  /** Last applied event seq, -1 when empty. */
  seq: number;
  /** Timestamp of the last applied event. */
  now: string | null;
  jobId: string | null;
  jobState: JobState | null;
  jobStateReason: string | null;
  providers: Record<string, P<"provider.updated">>;
  /** Latest telemetry per provider. */
  telemetry: Record<string, P<"telemetry.sample"> & { ts: string }>;
  /** Full loss history, for the chart. */
  progress: (P<"training.progress"> & { ts: string })[];
  activeProviderId: string | null;
  checkpoints: CheckpointView[];
  failures: (P<"failure.detected"> & { ts: string })[];
  recovery: (P<"recovery.step"> & { ts: string })[];
  fencingToken: number;
  compile: (P<"compile.decision"> & { ts: string })[];
  quality: (P<"quality.result"> & { ts: string })[];
  chain: (P<"chain.tx"> & { ts: string })[];
  settlement: P<"settlement.computed"> | null;
  /** Every applied event, newest last. */
  log: AnyGpuEvent[];
}

export const emptyState: DashboardState = {
  seq: -1,
  now: null,
  jobId: null,
  jobState: null,
  jobStateReason: null,
  providers: {},
  telemetry: {},
  progress: [],
  activeProviderId: null,
  checkpoints: [],
  failures: [],
  recovery: [],
  fencingToken: 0,
  compile: [],
  quality: [],
  chain: [],
  settlement: null,
  log: [],
};

const checkpointStateByType = {
  "checkpoint.committed": "COMMITTED",
  "checkpoint.verified": "VERIFIED",
  "checkpoint.accepted": "ACCEPTED",
  "checkpoint.rejected": "REJECTED",
} as const;

/** Ids from events become object keys; refuse the few that would reach the prototype instead. */
function safeKey(id: string): boolean {
  return id !== "__proto__" && id !== "constructor" && id !== "prototype";
}

/**
 * Pure reducer. Events with seq <= state.seq are dropped (duplicates or replays),
 * matching the agent-envelope rule in plan.md section E. Events whose provider id
 * can't be used as a key are dropped whole, so the log only holds applied events.
 */
export function reduce(state: DashboardState, ev: AnyGpuEvent): DashboardState {
  if (ev.seq <= state.seq) return state;
  if ((ev.type === "provider.updated" || ev.type === "telemetry.sample") && !safeKey(ev.payload.provider_id)) return state;

  const s: DashboardState = {
    ...state,
    seq: ev.seq,
    now: ev.ts,
    jobId: ev.job_id ?? state.jobId,
    log: [...state.log, ev],
  };

  switch (ev.type) {
    case "provider.updated":
      s.providers = { ...s.providers, [ev.payload.provider_id]: ev.payload };
      break;

    case "telemetry.sample":
      s.telemetry = {
        ...s.telemetry,
        [ev.payload.provider_id]: { ...ev.payload, ts: ev.ts },
      };
      break;

    case "job.state_changed":
      s.jobState = ev.payload.to;
      s.jobStateReason = ev.payload.reason;
      break;

    case "training.progress":
      s.progress = [...s.progress, { ...ev.payload, ts: ev.ts }];
      s.activeProviderId = ev.payload.provider_id;
      break;

    case "checkpoint.committed":
    case "checkpoint.verified":
    case "checkpoint.accepted":
    case "checkpoint.rejected": {
      const p = ev.payload;
      const next: CheckpointView = {
        checkpoint_id: p.checkpoint_id,
        provider_id: p.provider_id,
        step: p.step,
        manifest_hash: p.manifest_hash,
        state: checkpointStateByType[ev.type],
        reason: "reason" in p ? p.reason : null,
        ts: ev.ts,
      };
      const i = s.checkpoints.findIndex((c) => c.checkpoint_id === p.checkpoint_id);
      s.checkpoints =
        i === -1
          ? [...s.checkpoints, next]
          : s.checkpoints.map((c, j) => (j === i ? next : c));
      break;
    }

    case "failure.detected":
      s.failures = [...s.failures, { ...ev.payload, ts: ev.ts }];
      break;

    case "recovery.step":
      s.recovery = [...s.recovery, { ...ev.payload, ts: ev.ts }];
      s.fencingToken = Math.max(s.fencingToken, ev.payload.fencing_token);
      // The replacement is the active worker from here, before its first progress message arrives.
      if (ev.payload.stage === "ASSIGN" && ev.payload.provider_id) s.activeProviderId = ev.payload.provider_id;
      break;

    case "compile.decision":
      s.compile = [...s.compile, { ...ev.payload, ts: ev.ts }];
      break;

    case "quality.result": {
      // Each verifier's vote can arrive separately. One checkpoint is one row.
      const i = s.quality.findIndex((q) => q.checkpoint_id === ev.payload.checkpoint_id);
      const next = { ...ev.payload, ts: ev.ts };
      s.quality = i === -1 ? [...s.quality, next] : s.quality.map((q, j) => (j === i ? next : q));
      break;
    }

    case "chain.tx": {
      const i = s.chain.findIndex((t) => t.tx_hash === ev.payload.tx_hash);
      const next = { ...ev.payload, ts: ev.ts };
      s.chain = i === -1 ? [...s.chain, next] : s.chain.map((t, j) => (j === i ? next : t));
      break;
    }

    case "settlement.computed":
      s.settlement = ev.payload;
      break;
  }

  return s;
}

export function reduceAll(events: readonly AnyGpuEvent[]): DashboardState {
  return events.reduce(reduce, emptyState);
}
