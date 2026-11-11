import type { AnyGpuEvent, Recording } from "../events/types";

/**
 * Turns the real coordinator's events (docs/schemas/events.schema.json) into the dashboard's own.
 *
 * Pure, so live and replay behave identically: give it everything received so far and it rebuilds
 * the whole stream, which is also what makes out-of-order delivery harmless.
 */

export interface RealEvent {
  id: number;
  ts: string;
  type: string;
  job_id: string | null;
  provenance?: string;
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface RealProvider {
  provider_id: string;
  name: string;
  kind: "REAL" | "CAPPED_PROFILE" | "INJECTED_FAULT";
  status: string;
  capacity_mib: number | null;
  price_per_step: string;
  gpu_model?: string | null;
  gpu_vram_mib?: number | null;
  compute_cap?: string | null;
  hardware_evidence?: string | null;
  physical_gpu_id?: string | null;
}

export interface SettlementPreview {
  steps: Record<string, number>;
  payouts: Record<string, string>;
  refund: string;
  budget: string;
}

/** A plain JSON copy of a real run, like public/replay.json. */
export interface RealRecording {
  recorded_at: string;
  note: string;
  providers: RealProvider[];
  events: RealEvent[];
}

const CAUSES: Record<string, string> = { PROCESS_EXIT: "RUNTIME_EXIT", HEARTBEAT_LOST: "HEARTBEAT_LOSS" };
const TELEMETRY_SOURCES: Record<string, string> = { HOST_NVML: "host_nvml", CONTAINER_NVML: "container_nvml" };
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Screens colour and label providers by a short id. A real id is a UUID, so this gives each one a letter. */
export function providerLetters(providers: readonly RealProvider[]): Map<string, string> {
  const letters = new Map<string, string>();
  const used = new Set<string>();
  const sorted = [...providers].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const named = p.name.match(/^Provider ([A-Z])\b/)?.[1] ?? (/^[a-z]$/i.test(p.name) ? p.name.toUpperCase() : null);
    if (named && !used.has(named)) {
      letters.set(p.provider_id, named);
      used.add(named);
    }
  }
  for (const p of sorted) {
    if (letters.has(p.provider_id)) continue;
    const next = [...LETTERS].find((l) => !used.has(l)) ?? p.provider_id.slice(0, 4);
    letters.set(p.provider_id, next);
    used.add(next);
  }
  return letters;
}

/** 6-decimal USDC as an integer, so sums are exact. */
const micros = (usdc: string | number) => Math.round(Number(usdc) * 1e6);
const fromMicros = (m: number) => (m / 1e6).toFixed(6);
const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function execConfig(e: Record<string, unknown> | null | undefined) {
  if (!e) return null;
  return { micro_batch: Number(e.micro_batch), accum: Number(e.accumulation), amp: e.amp as "bf16" | "fp16" | "fp32", grad_ckpt: !!e.grad_checkpointing };
}

export interface TranslateOptions {
  /** The coordinator's own payout figures. Live mode only. */
  preview?: SettlementPreview | null;
  /** Work the payout out from the events, for a recording that has no server to ask. */
  localBudget?: string;
  /** Timestamp to use when no event has arrived yet. */
  nowIso?: string;
}

export function translate(input: readonly RealEvent[], providers: readonly RealProvider[], options: TranslateOptions = {}): AnyGpuEvent[] {
  const raw = [...input].sort((a, b) => a.id - b.id);
  const letters = providerLetters(providers);
  const byId = new Map(providers.map((p) => [p.provider_id, p]));
  const who = (id: string | null | undefined): string => {
    if (!id) return "unknown";
    let letter = letters.get(id);
    if (!letter) {
      const used = new Set(letters.values());
      letter = [...LETTERS].find((l) => !used.has(l)) ?? id.slice(0, 4);
      letters.set(id, letter);
    }
    return letter;
  };
  const injectedKind = (provider: string | null) => !!provider && providers.some((p) => who(p.provider_id) === provider && p.kind === "INJECTED_FAULT");

  const out: AnyGpuEvent[] = [];
  const push = (type: string, ts: string, jobId: string | null, payload: unknown) => {
    out.push({ seq: out.length, ts, job_id: jobId, type, payload } as AnyGpuEvent);
  };

  const firstTs = raw[0]?.ts ?? options.nowIso ?? new Date(0).toISOString();
  const jobOf = raw[0]?.job_id ?? null;
  for (const p of providers) {
    push("provider.updated", firstTs, jobOf, {
      provider_id: who(p.provider_id),
      name: p.name,
      kind: p.kind,
      status: { ONLINE: "online", BUSY: "busy", SUSPECT: "suspect" }[p.status] ?? "offline",
      separate_machine: false,
      // Every CPU provider in the fallback is this one computer.
      physical_gpu_id: p.gpu_model === "CPU" ? "cpu" : (p.physical_gpu_id ?? p.gpu_model ?? p.provider_id),
      gpu: {
        model: p.gpu_model ?? "unknown GPU",
        vram_mib: p.gpu_vram_mib ?? 0,
        cap_mib: p.capacity_mib,
        compute_cap: p.compute_cap ?? "unknown",
        evidence: p.hardware_evidence ?? "CLAIMED",
      },
      price_per_step_usdc: p.price_per_step,
    });
  }

  let attempt = 1;
  let token = 1;
  let assigned: string | null = null; // Who is allowed to be training now. Null during a recovery.
  let recovering = false;
  let lastExec: Record<string, unknown> | null = null;
  let lastRejected: string | null = null;
  let resumeStep = 0;
  let stateNow: string | null = null;
  const execFor = new Map<string, Record<string, unknown>>();
  const signerOf = new Map<string, string>();
  const started = new Map<string, number>(); // Where each provider's latest attempt began.
  const checkpoints = new Map<string, { step: number; provider: string; state: string; signer: string | null }>();
  const votes = new Map<string, { signer: string; verdict: string }[]>();
  const rejected = new Map<string, { steps: number; reason: string }>();

  const checkpointOwner = (d: Record<string, any>): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (d.provider_id) return who(d.provider_id);
    const known = d.signer ? signerOf.get(d.signer.toLowerCase()) : null;
    if (known) return known;
    if (d.signer && assigned) signerOf.set(d.signer.toLowerCase(), assigned);
    return assigned ?? "unknown";
  };

  const emitLocalSettlement = (ts: string, jobId: string | null) => {
    if (options.localBudget === undefined) return;
    const accepted = [...checkpoints.values()].filter((c) => c.state === "ACCEPTED").sort((a, b) => a.step - b.step);
    const steps = new Map<string, number>();
    let previous = 0;
    for (const c of accepted) {
      steps.set(c.provider, (steps.get(c.provider) ?? 0) + (c.step - previous));
      previous = c.step;
    }
    const payees = [...steps].map(([provider, count]) => {
      const source = providers.find((p) => who(p.provider_id) === provider);
      return { provider_id: provider, accepted_steps: count, amount_usdc: fromMicros(micros(source?.price_per_step ?? 0) * count) };
    });
    const paid = payees.reduce((sum, p) => sum + micros(p.amount_usdc), 0);
    push("settlement.computed", ts, jobId, {
      payees,
      zero_paid: zeroPaid(),
      refund_usdc: fromMicros(micros(options.localBudget) - paid),
      budget_usdc: options.localBudget,
    });
  };
  const zeroPaid = () => [...rejected].map(([provider_id, r]) => ({ provider_id, rejected_steps: r.steps, reason: r.reason }));
  // Screens read a provider's name, not its id, so raw ids in the text are replaced.
  const nameIds = (text: unknown) =>
    String(text ?? "").replace(/(?:[Pp]rovider )?[0-9a-f]{8}-[0-9a-f-]{27}/g, (match) => {
      const id = match.slice(-36);
      return (providers.find((p) => p.provider_id === id)?.name ?? `Provider ${who(id)}`).replace(/ \(.*\)$/, "");
    });

  for (const e of raw) {
    const d = e.data;
    switch (e.type) {
      case "job.state_changed":
        stateNow = d.to;
        if (d.to === "RECOVERING") {
          recovering = true;
          assigned = null;
        }
        push("job.state_changed", e.ts, e.job_id, { from: d.from ?? null, to: d.to, reason: nameIds(d.reason) });
        if (d.to === "COMPLETED") emitLocalSettlement(e.ts, e.job_id);
        break;

      case "training.progress": {
        const provider = who(d.provider_id);
        // A replaced worker's last messages can still arrive. They mustn't look like new work.
        if (recovering && provider !== assigned) break;
        if (assigned && provider !== assigned) break;
        assigned = provider;
        if (!started.has(provider)) started.set(provider, resumeStep);
        lastExec = lastExec ?? execFor.get(`${attempt}:${provider}`) ?? null; // The first placement's config.
        push("training.progress", e.ts, e.job_id, { provider_id: provider, attempt: d.attempt ?? attempt, step: d.step, total_steps: d.total_steps, loss: d.loss, steps_per_s: d.steps_per_s ?? null });
        break;
      }

      case "checkpoint.committed":
      case "checkpoint.verified":
      case "checkpoint.accepted":
      case "checkpoint.rejected": {
        const hash = d.checkpoint_hash;
        const known = checkpoints.get(hash);
        const provider = known?.provider ?? checkpointOwner(d);
        const state = e.type.split(".")[1].toUpperCase();
        checkpoints.set(hash, { step: d.step, provider, state, signer: d.signer ?? null });
        const payload = { checkpoint_id: hash, provider_id: provider, step: d.step, manifest_hash: hash, fencing_token: token };
        if (e.type !== "checkpoint.rejected") {
          push(e.type, e.ts, e.job_id, payload);
          break;
        }
        const reason = d.reason || "Rejected by Quality Guard";
        push(e.type, e.ts, e.job_id, { ...payload, reason });
        // The coordinator refuses everything else this attempt wrote, too.
        for (const [otherHash, other] of checkpoints) {
          if (otherHash !== hash && other.provider === provider && other.state !== "ACCEPTED" && other.state !== "REJECTED") {
            other.state = "REJECTED";
            push(e.type, e.ts, e.job_id, { checkpoint_id: otherHash, provider_id: provider, step: other.step, manifest_hash: otherHash, fencing_token: token, reason });
          }
        }
        // The dashboard tells this story through a failure entry.
        lastRejected = provider;
        rejected.set(provider, { steps: Math.max(0, d.step - (started.get(provider) ?? 0)), reason: "Segment rejected by Quality Guard" });
        push("failure.detected", e.ts, e.job_id, { provider_id: provider, cause: "QUALITY_REJECTED", injected: injectedKind(provider), detail: `Quality Guard rejected the checkpoint at step ${d.step}` });
        break;
      }

      case "failure.detected":
        push("failure.detected", e.ts, e.job_id, {
          provider_id: who(d.provider_id),
          cause: CAUSES[d.cause] ?? d.cause,
          injected: !!d.injected,
          detail: typeof d.last_step === "number" ? `Last reported step ${d.last_step}` : "",
        });
        break;

      case "recovery.step": {
        attempt = d.attempt ?? attempt;
        token = d.fencing_token ?? Math.max(token, attempt);
        let provider: string | null = d.provider_id ? who(d.provider_id) : null;
        const uuid = typeof d.detail === "string" ? d.detail.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0] : null;
        if (!provider && d.stage === "ASSIGN" && uuid) provider = who(uuid);
        if (!provider && d.stage === "DETECTED" && uuid) provider = who(uuid);
        if (!provider && d.stage === "FENCED") provider = lastRejected;
        let checkpoint: string | null = d.checkpoint_hash ?? null;
        if (d.stage === "SELECT_CHECKPOINT") {
          const step = Number(d.detail?.match(/step (\d+)/)?.[1] ?? 0);
          resumeStep = d.resume_step ?? step;
          if (!checkpoint) checkpoint = [...checkpoints].find(([, c]) => c.step === resumeStep && c.state !== "REJECTED")?.[0] ?? null;
        }
        if (d.stage === "ASSIGN" && provider) {
          assigned = provider;
          recovering = false;
          started.set(provider, resumeStep);
          lastExec = execFor.get(`${attempt}:${provider}`) ?? lastExec;
        }
        const detail = nameIds(d.detail);
        // A rollback throws away what the rejected provider did, which the coordinator doesn't count as lost.
        const rollbackLost = d.stage === "SELECT_CHECKPOINT" && d.lost_steps == null && lastRejected ? (rejected.get(lastRejected)?.steps ?? null) : null;
        push("recovery.step", e.ts, e.job_id, { attempt, stage: d.stage, fencing_token: token, detail, provider_id: provider, checkpoint_id: checkpoint, lost_steps: d.lost_steps ?? rollbackLost });
        break;
      }

      case "compile.decision": {
        const provider = who(d.provider_id);
        const compileAttempt = d.attempt ?? attempt;
        if (d.exec) execFor.set(`${compileAttempt}:${provider}`, d.exec);
        push("compile.decision", e.ts, e.job_id, {
          attempt: compileAttempt,
          provider_id: provider,
          verdict: d.decision === "ACCEPTED" ? "accepted" : "rejected",
          from: execConfig(d.from_exec ?? (assigned || lastExec ? lastExec : null)),
          to: execConfig(d.exec),
          reason: d.reason ?? "",
          probe: typeof d.peak_mem_mib === "number" ? { peak_mem_mib: d.peak_mem_mib, steps_per_s: d.steps_per_s ?? null } : null,
        });
        break;
      }

      case "quality.result": {
        // One event per verifier here, one row per checkpoint on screen.
        const list = votes.get(d.checkpoint_hash) ?? [];
        list.push({ signer: shortAddress(String(d.verifier ?? "verifier")), verdict: d.verdict === "PASS" ? "pass" : "reject" });
        votes.set(d.checkpoint_hash, list);
        push("quality.result", e.ts, e.job_id, {
          checkpoint_id: d.checkpoint_hash,
          verdict: d.verdict === "PASS" ? "pass" : "reject",
          metric: "accuracy",
          candidate: d.accuracy,
          reference: d.accuracy - d.difference,
          ci_lower: d.ci_lower,
          margin: d.margin,
          n: null,
          verifiers: list.map((v) => ({ ...v })),
        });
        break;
      }

      case "chain.tx":
        push("chain.tx", e.ts, e.job_id, {
          kind: d.action,
          status: String(d.status).toLowerCase(),
          tx_hash: d.tx_hash ?? `failed-${e.id}`,
          chain: d.local_chain ? "anvil" : "base-sepolia",
          explorer_url: d.explorer_url ?? null,
        });
        break;

      case "telemetry.sample": {
        const source = byId.get(d.provider_id);
        push("telemetry.sample", e.ts, e.job_id, {
          provider_id: who(d.provider_id),
          util_pct: d.util_pct ?? null,
          mem_used_mib: d.mem_used_mib ?? null,
          mem_total_mib: source?.gpu_vram_mib ?? null,
          temp_c: d.temp_c ?? null,
          power_w: d.power_w ?? null,
          source: TELEMETRY_SOURCES[d.source] ?? d.source,
        });
        break;
      }
    }
  }

  if (options.preview && (stateNow === "COMPLETED" || stateNow === "SETTLED" || stateNow === "DISPUTED")) {
    const { preview } = options;
    const letterOfName = (name: string) => {
      const match = providers.find((p) => p.name === name);
      return match ? who(match.provider_id) : name;
    };
    push("settlement.computed", raw.at(-1)?.ts ?? firstTs, jobOf, {
      payees: Object.entries(preview.payouts)
        .map(([name, amount]) => ({ provider_id: letterOfName(name), accepted_steps: preview.steps[name] ?? 0, amount_usdc: amount }))
        .sort((a, b) => a.provider_id.localeCompare(b.provider_id)),
      zero_paid: zeroPaid(),
      refund_usdc: preview.refund,
      budget_usdc: preview.budget,
    });
  }
  return out;
}

/** The recorded real run, for the replay player. The run's budget isn't in the file, so it's passed in. */
export function recordingFromRealRun(recording: RealRecording, budgetUsdc: string): Recording {
  return {
    format: "gpuchain-replay/1",
    provenance: "recorded",
    title: `Real run recorded on ${recording.recorded_at}`,
    description: "RTX 3060 and a local chain. Single run, one seed. Payout worked out from the accepted checkpoints",
    events: translate(recording.events, recording.providers, { localBudget: budgetUsdc }),
  };
}
