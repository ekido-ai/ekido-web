/**
 * DRAFT event catalog for the dashboard.
 *
 * Derived from plan.md section E ("Real-time channels"). The source of truth will be
 * Piyush's frozen schemas in docs/schemas/. When those land, replace this file with
 * types generated into packages/shared-types and fix whatever the compiler flags.
 *
 * `settlement.computed` is not in the plan's channel list yet; it is proposed here
 * so the settlement screen has something to render.
 */

export type ProviderKind = "REAL" | "CAPPED_PROFILE" | "INJECTED_FAULT";
export type Evidence = "CLAIMED" | "OBSERVED" | "MEASURED" | "VERIFIER_CHECKED";
export type ProviderStatus = "online" | "busy" | "suspect" | "offline";

export type JobState =
  | "OPEN"
  | "ASSIGNED"
  | "RUNNING"
  | "RECOVERING"
  | "VALIDATING"
  | "COMPLETED"
  | "DISPUTED"
  | "SETTLED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

export type RecoveryStage =
  | "DETECTED"
  | "FENCED"
  | "SELECT_CHECKPOINT"
  | "HANDOVER_EVAL"
  | "FIND_CANDIDATES"
  | "COMPILE"
  | "PROBE"
  | "ASSIGN"
  | "RESTORE"
  | "CANARY_CHECK"
  | "RESUMED"
  | "ABORT";

export type CheckpointState = "COMMITTED" | "VERIFIED" | "ACCEPTED" | "REJECTED";

export interface ExecConfig {
  micro_batch: number;
  accum: number;
  amp: "bf16" | "fp16" | "fp32";
  grad_ckpt: boolean;
}

export interface EventPayloads {
  "provider.updated": {
    provider_id: string;
    name: string;
    kind: ProviderKind;
    status: ProviderStatus;
    /** True when the provider is a separate physical machine. */
    separate_machine: boolean;
    /** Profiles that share one physical GPU share this id (DB: providers.physical_gpu_id). */
    physical_gpu_id: string;
    gpu: {
      model: string;
      vram_mib: number;
      /** Allocator cap for CAPPED_PROFILE providers. */
      cap_mib: number | null;
      compute_cap: string;
      evidence: Evidence;
    };
    price_per_step_usdc: string;
  };
  "telemetry.sample": {
    provider_id: string;
    util_pct: number | null;
    mem_used_mib: number | null;
    mem_total_mib: number | null;
    temp_c: number | null;
    power_w: number | null;
    source: "host_nvml" | "container_nvml";
  };
  "job.state_changed": {
    from: JobState | null;
    to: JobState;
    reason: string;
  };
  "training.progress": {
    provider_id: string;
    attempt: number;
    step: number;
    total_steps: number;
    loss: number;
    steps_per_s: number | null;
  };
  "checkpoint.committed": CheckpointPayload;
  "checkpoint.verified": CheckpointPayload;
  "checkpoint.accepted": CheckpointPayload;
  "checkpoint.rejected": CheckpointPayload & { reason: string };
  "failure.detected": {
    provider_id: string;
    cause: "RUNTIME_EXIT" | "OOM" | "HEARTBEAT_LOSS" | "DISCONNECT" | "QUALITY_REJECTED" | "BAD_CHECKPOINT" | "START_FAILED" | "DIVERGED" | "NO_FINAL_CHECKPOINT";
    injected: boolean;
    detail: string;
  };
  "recovery.step": {
    attempt: number;
    stage: RecoveryStage;
    fencing_token: number;
    detail: string;
    /**
     * Structured fields (mirror DB recovery_events), set on the stages where they apply:
     * DETECTED: the failed provider. ASSIGN: the replacement provider.
     * SELECT_CHECKPOINT: checkpoint_id and lost_steps.
     */
    provider_id?: string | null;
    checkpoint_id?: string | null;
    lost_steps?: number | null;
  };
  "compile.decision": {
    attempt: number;
    provider_id: string;
    verdict: "accepted" | "rejected";
    from: ExecConfig | null;
    to: ExecConfig | null;
    reason: string;
    probe: { peak_mem_mib: number; steps_per_s: number } | null;
  };
  "quality.result": {
    checkpoint_id: string;
    verdict: "pass" | "reject";
    metric: "accuracy";
    candidate: number;
    reference: number;
    /** One-sided 95% lower bound of candidate - reference. */
    ci_lower: number;
    margin: number;
    /** The coordinator doesn't report the evaluation set size yet. */
    n: number | null;
    verifiers: { signer: string; verdict: "pass" | "reject" }[];
  };
  "chain.tx": {
    kind: "createJob" | "markActive" | "anchorEvent" | "submitAttestation" | "finalize" | "withdraw";
    status: "pending" | "confirmed" | "failed";
    tx_hash: string;
    chain: "base-sepolia" | "anvil";
    explorer_url: string | null;
  };
  "settlement.computed": {
    payees: { provider_id: string; accepted_steps: number; amount_usdc: string }[];
    zero_paid: { provider_id: string; rejected_steps: number; reason: string }[];
    refund_usdc: string;
    budget_usdc: string;
  };
}

export interface CheckpointPayload {
  checkpoint_id: string;
  provider_id: string;
  step: number;
  manifest_hash: string;
  fencing_token: number;
}

export type EventType = keyof EventPayloads;

export interface GpuEvent<T extends EventType = EventType> {
  /** Monotonic per stream. */
  seq: number;
  /** ISO-8601 timestamp. */
  ts: string;
  job_id: string | null;
  type: T;
  payload: EventPayloads[T];
}

export type AnyGpuEvent = { [K in EventType]: GpuEvent<K> }[EventType];

export interface Recording {
  format: "gpuchain-replay/1";
  /**
   * "sample": hand-authored fixture, numbers are illustrative.
   * "recorded": captured from a real run. Only "recorded" may back a claim in the pitch.
   */
  provenance: "sample" | "recorded";
  title: string;
  description: string;
  events: AnyGpuEvent[];
}
