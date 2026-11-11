/**
 * Generates replay/recordings/sample-demo.json: a hand-authored fixture that follows
 * the 4-minute demo sequence in plan.md section J.
 *
 * EVERY NUMBER HERE IS ILLUSTRATIVE. The file is marked provenance "sample" and the UI
 * shows a SAMPLE badge while it plays. Never quote these numbers in the pitch; replace
 * this with a real recording ("recorded") once the backend emits events.
 *
 * Run (Node 24 strips types natively):  npm run replay:generate
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnyGpuEvent,
  EventPayloads,
  EventType,
  ExecConfig,
  JobState,
  RecoveryStage,
  Recording,
} from "../src/lib/events/types.ts";

const JOB = "job-sample-0001";
const T0 = Date.parse("2026-11-13T10:00:00.000Z");
const TOTAL = 300;
const RATE = 0.01; // USDC per accepted step (illustrative)

const events: AnyGpuEvent[] = [];
let seq = 0;
function emit<T extends EventType>(atS: number, type: T, payload: EventPayloads[T]) {
  events.push({
    seq: seq++,
    ts: new Date(T0 + Math.round(atS * 1000)).toISOString(),
    job_id: type === "provider.updated" || type === "telemetry.sample" ? null : JOB,
    type,
    payload,
  } as AnyGpuEvent);
}

// Seeded PRNG so the fixture is stable across regenerations.
let rng = 1337;
const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
const honestAcc = (step: number) => 0.25 + 0.66 * (1 - Math.exp(-step / 45)) + (rand() - 0.5) * 0.004;
const honestLoss = (step: number) => 1.15 * Math.exp(-step / 70) + 0.24 + (rand() - 0.5) * 0.05;

let jobState: JobState | null = null;
function state(at: number, to: JobState, reason: string) {
  emit(at, "job.state_changed", { from: jobState, to, reason });
  jobState = to;
}

let token = 1;
function rec(
  at: number,
  attempt: number,
  stage: RecoveryStage,
  detail: string,
  extra: { provider_id?: string; checkpoint_id?: string; lost_steps?: number } = {},
) {
  emit(at, "recovery.step", { attempt, stage, fencing_token: token, detail, ...extra });
}

function tx(at: number, kind: EventPayloads["chain.tx"]["kind"], confirmAfter = 3) {
  const tx_hash = `0x${hex(64)}`;
  const base = { kind, tx_hash, chain: "base-sepolia" as const, explorer_url: `https://sepolia.basescan.org/tx/${tx_hash}` };
  emit(at, "chain.tx", { ...base, status: "pending" });
  emit(at + confirmAfter, "chain.tx", { ...base, status: "confirmed" });
}

const GPU = { model: "RTX 3060 Laptop", vram_mib: 6144, compute_cap: "8.6" };
const providers = {
  A: { name: "Provider A", kind: "REAL", cap_mib: null, price: "0.010" },
  B: { name: "Provider B", kind: "CAPPED_PROFILE", cap_mib: 3072, price: "0.010" },
  C: { name: "Provider C", kind: "CAPPED_PROFILE", cap_mib: 1024, price: "0.008" },
  P: { name: "Provider P", kind: "INJECTED_FAULT", cap_mib: null, price: "0.006" },
} as const;
type Pid = keyof typeof providers;

function provider(at: number, id: Pid, status: EventPayloads["provider.updated"]["status"]) {
  const p = providers[id];
  emit(at, "provider.updated", {
    provider_id: id,
    name: p.name,
    kind: p.kind,
    status,
    separate_machine: false,
    physical_gpu_id: "gpu-laptop-3060",
    gpu: { ...GPU, cap_mib: p.cap_mib, evidence: "OBSERVED" },
    price_per_step_usdc: p.price,
  });
}

/** Train `id` from step `from` to `to`, emitting progress each second. Returns end time. */
function train(
  start: number,
  id: Pid,
  attempt: number,
  from: number,
  to: number,
  stepsPerS: number,
  memMib: number,
  opts: {
    lossFn?: (s: number) => number;
    checkpoints?: number[];
    onCheckpoint?: (at: number, step: number) => void;
  } = {},
) {
  const lossFn = opts.lossFn ?? honestLoss;
  let t = start;
  let step = from;
  let lastTele = -Infinity;
  const cks = new Set(opts.checkpoints ?? []);
  while (step < to) {
    t += 1;
    const next = Math.min(to, step + stepsPerS);
    for (let s = Math.floor(step) + 1; s <= Math.floor(next); s++) {
      if (cks.has(s)) opts.onCheckpoint?.(t, s);
    }
    step = next;
    emit(t, "training.progress", {
      provider_id: id,
      attempt,
      step: Math.floor(step),
      total_steps: TOTAL,
      loss: Number(lossFn(step).toFixed(4)),
      steps_per_s: stepsPerS,
    });
    if (t - lastTele >= 2) {
      lastTele = t;
      emit(t, "telemetry.sample", {
        provider_id: id,
        util_pct: Math.round(90 + rand() * 8),
        mem_used_mib: Math.round(memMib + rand() * 60),
        mem_total_mib: providers[id].cap_mib ?? GPU.vram_mib,
        temp_c: Math.round(71 + rand() * 6),
        power_w: Math.round(78 + rand() * 10),
        source: "host_nvml",
      });
    }
  }
  return t;
}

const ckId = (id: Pid, step: number) => `ck-${id}-${String(step).padStart(4, "0")}`;
let lastAcceptedAcc = 0.25; // untrained baseline (illustrative)
const VERIFIERS = ["0xV1", "0xV2", "0xV3"];

function checkpoint(at: number, id: Pid, step: number, honest: boolean) {
  const base = {
    checkpoint_id: ckId(id, step),
    provider_id: id,
    step,
    manifest_hash: `0x${hex(16)}`,
    fencing_token: token,
  };
  emit(at, "checkpoint.committed", base);
  emit(at + 1, "checkpoint.verified", base);
  const candidate = honest ? honestAcc(step) : 0.71;
  const ci_lower = candidate - lastAcceptedAcc - 0.012;
  const verdict = ci_lower >= -0.02 ? "pass" : "reject";
  emit(at + 3, "quality.result", {
    checkpoint_id: base.checkpoint_id,
    verdict,
    metric: "accuracy",
    candidate: Number(candidate.toFixed(4)),
    reference: Number(lastAcceptedAcc.toFixed(4)),
    ci_lower: Number(ci_lower.toFixed(4)),
    margin: 0.02,
    n: 2000,
    verifiers: VERIFIERS.map((signer) => ({ signer, verdict })),
  });
  if (verdict === "pass") {
    emit(at + 3, "checkpoint.accepted", base);
    lastAcceptedAcc = candidate;
  } else {
    emit(at + 3, "checkpoint.rejected", {
      ...base,
      reason: `Accuracy lower bound ${(ci_lower * 100).toFixed(1)} pts is below the -2.0 pt margin`,
    });
  }
  return verdict;
}

const full: ExecConfig = { micro_batch: 32, accum: 1, amp: "bf16", grad_ckpt: false };
const adapted: ExecConfig = { micro_batch: 8, accum: 4, amp: "bf16", grad_ckpt: false };

// 0:00 provider grid
(Object.keys(providers) as Pid[]).forEach((id) => provider(0, id, "online"));
state(1, "OPEN", "Job created, waiting for escrow funding");

// 0:20 escrow funded
tx(4, "createJob");
state(8, "ASSIGNED", "Scheduler picked Provider A: lowest expected cost with a full-memory fit");
tx(8, "markActive");
provider(9, "A", "busy");
state(10, "RUNNING", "Training started on Provider A");

// Training on A, checkpoints at 50 and 100, killed at ~110.
let t = train(10, "A", 1, 0, 112, 1.6, 4810, {
  checkpoints: [50, 100],
  onCheckpoint: (at, s) => checkpoint(at, "A", s, true),
});

// 1:25 kill
t += 1;
emit(t, "failure.detected", {
  provider_id: "A",
  cause: "RUNTIME_EXIT",
  injected: true,
  detail: "Container killed from the dashboard (docker kill)",
});
provider(t, "A", "offline");
state(t, "RECOVERING", "Provider A stopped: runtime exited");
rec(t, 2, "DETECTED", "Runtime exit reported by agent", { provider_id: "A" });
token = 2;
rec(t + 1, 2, "FENCED", "Fencing token 1 → 2. Writes from the old worker are now rejected");
rec(t + 2, 2, "SELECT_CHECKPOINT", `Using ${ckId("A", 100)} (step 100, accepted). 12 steps lost`, {
  checkpoint_id: ckId("A", 100),
  lost_steps: 12,
});
tx(t + 2, "anchorEvent");
rec(t + 3, 2, "FIND_CANDIDATES", "3 providers online: B, C, P");
emit(t + 4, "compile.decision", {
  attempt: 2, provider_id: "P", verdict: "accepted", from: full, to: full,
  reason: "Fits at the current config. Cheapest expected cost", probe: { peak_mem_mib: 4790, steps_per_s: 1.6 },
});
rec(t + 5, 2, "ASSIGN", "Assigned to Provider P", { provider_id: "P" });
rec(t + 6, 2, "RESTORE", "Checkpoint restored on Provider P");
rec(t + 7, 2, "CANARY_CHECK", "Canary loss matches the manifest");
rec(t + 7, 2, "RESUMED", "Resumed at step 100");
provider(t + 7, "P", "busy");
state(t + 7, "RUNNING", "Training resumed on Provider P");

// 1:50 P "trains" and reports suspiciously good loss.
t = train(t + 7, "P", 2, 100, 150, 2.2, 4790, {
  lossFn: () => 0.12 + rand() * 0.02,
  checkpoints: [150],
  onCheckpoint: (at, s) => checkpoint(at, "P", s, false),
});
t += 3;

// 2:10 rejection + rollback
emit(t, "failure.detected", {
  provider_id: "P",
  cause: "QUALITY_REJECTED",
  injected: true,
  detail: "Quality Guard rejected the checkpoint at step 150. Provider P is a deliberately bad trainer",
});
provider(t, "P", "online");
state(t, "RECOVERING", "Candidate rejected by Quality Guard, rolling back");
rec(t, 3, "DETECTED", "Rejected checkpoint from Provider P", { provider_id: "P" });
token = 3;
rec(t + 1, 3, "FENCED", "Fencing token 2 → 3. Provider P's segment earns 0");
rec(t + 2, 3, "SELECT_CHECKPOINT", `Rolling back to ${ckId("A", 100)} (last accepted). 50 steps discarded`, {
  checkpoint_id: ckId("A", 100),
  lost_steps: 50,
});
tx(t + 2, "anchorEvent");
rec(t + 3, 3, "FIND_CANDIDATES", "Excluding P. Candidates: B, C");
rec(t + 4, 3, "COMPILE", "Compiling for B and C");

// 2:30 compile table
emit(t + 5, "compile.decision", {
  attempt: 3, provider_id: "C", verdict: "rejected", from: full, to: null,
  reason: "Probe OOM at micro_batch=1 under the 1024 MiB cap", probe: null,
});
rec(t + 6, 3, "PROBE", "Probing B at micro_batch 32, 16, 8");
emit(t + 8, "compile.decision", {
  attempt: 3, provider_id: "B", verdict: "accepted", from: full, to: adapted,
  reason: "Probe OOM at 32 and 16 under the 3072 MiB cap. 8 × 4 fits at 84% peak",
  probe: { peak_mem_mib: 2580, steps_per_s: 1.2 },
});
rec(t + 9, 3, "ASSIGN", "Assigned to Provider B: micro_batch 8, accumulation 4. Logical batch stays 32", {
  provider_id: "B",
});
rec(t + 10, 3, "RESTORE", "Checkpoint restored on Provider B");
rec(t + 11, 3, "CANARY_CHECK", "Canary loss matches the manifest");
rec(t + 11, 3, "RESUMED", "Resumed at step 100");
provider(t + 11, "B", "busy");
state(t + 11, "RUNNING", "Training resumed on Provider B");

// 2:50 B finishes
t = train(t + 11, "B", 3, 100, 300, 2.4, 2560, {
  checkpoints: [150, 200, 250, 300],
  onCheckpoint: (at, s) => checkpoint(at, "B", s, true),
});

// 3:15 final evaluation + attestation
t += 4;
provider(t, "B", "online");
state(t, "VALIDATING", "Final evaluation by verifiers");
tx(t + 2, "submitAttestation");
state(t + 5, "COMPLETED", "2 of 3 verifier signatures accepted. Dispute window open");

// 3:35 settlement
emit(t + 6, "settlement.computed", {
  payees: [
    { provider_id: "A", accepted_steps: 100, amount_usdc: (100 * RATE).toFixed(2) },
    { provider_id: "B", accepted_steps: 200, amount_usdc: (200 * RATE).toFixed(2) },
  ],
  zero_paid: [{ provider_id: "P", rejected_steps: 50, reason: "Segment rejected by Quality Guard" }],
  refund_usdc: (5 - 300 * RATE).toFixed(2),
  budget_usdc: "5.00",
});
tx(t + 12, "finalize");
state(t + 16, "SETTLED", "Dispute window closed. Balances credited");

// Events are emitted out of time order (e.g. a quality result 3 s after its checkpoint while
// training continues). Stable-sort by time and renumber so seq order == time order.
events.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts) || a.seq - b.seq);
events.forEach((e, i) => (e.seq = i));

const recording: Recording = {
  format: "gpuchain-replay/1",
  provenance: "sample",
  title: "Sample demo: kill, reject, adapt, settle",
  description:
    "Hand-authored fixture following plan.md section J. Numbers are illustrative, not measured.",
  events,
};

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "recordings", "sample-demo.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(recording, null, 1) + "\n");
console.log(`Wrote ${events.length} events, ${(Date.parse(events.at(-1)!.ts) - T0) / 1000}s → ${out}`);
