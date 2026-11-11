import type { DashboardState } from "./reduce";
import type { ExecConfig } from "./types";

/** Starting value from plan.md section G: a probe passes if peak ≤ 85% of capacity. */
export const PROBE_LIMIT = 0.85;

// ------------------------------------------------------------ compile

export interface CompileRow {
  providerId: string;
  verdict: "accepted" | "rejected";
  from: ExecConfig | null;
  to: ExecConfig | null;
  reason: string;
  /** Memory the provider may use: its cap, else full VRAM. */
  capacityMib: number | null;
  peakMib: number | null;
  /** peak / capacity, 0..1 */
  peakFrac: number | null;
  stepsPerS: number | null;
  /** True when micro_batch × accum is unchanged (the logical-step invariant). */
  logicalBatchKept: boolean | null;
}

export interface CompileAttempt {
  attempt: number;
  rows: CompileRow[];
}

const logical = (c: ExecConfig) => c.micro_batch * c.accum;

export function compileAttempts(s: DashboardState): CompileAttempt[] {
  const map = new Map<number, CompileRow[]>();
  for (const d of s.compile) {
    const p = s.providers[d.provider_id];
    const capacityMib = p ? (p.gpu.cap_mib ?? p.gpu.vram_mib) : null;
    const peakMib = d.probe?.peak_mem_mib ?? null;
    const row: CompileRow = {
      providerId: d.provider_id,
      verdict: d.verdict,
      from: d.from,
      to: d.to,
      reason: d.reason,
      capacityMib,
      peakMib,
      peakFrac: peakMib !== null && capacityMib ? peakMib / capacityMib : null,
      stepsPerS: d.probe?.steps_per_s ?? null,
      logicalBatchKept: d.from && d.to ? logical(d.from) === logical(d.to) : null,
    };
    map.set(d.attempt, [...(map.get(d.attempt) ?? []), row]);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([attempt, rows]) => ({ attempt, rows }));
}

/** Fields that differ between two configs, for the "what changed" column. */
export function configChanges(from: ExecConfig | null, to: ExecConfig | null) {
  if (!from || !to) return [];
  const out: { field: string; from: string; to: string }[] = [];
  const names: [keyof ExecConfig, string][] = [
    ["micro_batch", "Micro-batch"],
    ["accum", "Accumulation"],
    ["amp", "Precision"],
    ["grad_ckpt", "Gradient checkpointing"],
  ];
  for (const [k, label] of names) {
    if (from[k] !== to[k]) out.push({ field: label, from: String(from[k]), to: String(to[k]) });
  }
  return out;
}

// ------------------------------------------------------------ quality

export interface QualityRow {
  checkpointId: string;
  providerId: string | null;
  step: number | null;
  verdict: "pass" | "reject";
  candidate: number;
  reference: number;
  /** candidate - reference, as a fraction (0.01 = 1 point). */
  delta: number;
  ciLower: number;
  margin: number;
  n: number | null;
  verifiers: { signer: string; verdict: "pass" | "reject" }[];
  ts: string;
}

export function qualityRows(s: DashboardState): QualityRow[] {
  return s.quality.map((q) => {
    const ck = s.checkpoints.find((c) => c.checkpoint_id === q.checkpoint_id);
    return {
      checkpointId: q.checkpoint_id,
      providerId: ck?.provider_id ?? null,
      step: ck?.step ?? null,
      verdict: q.verdict,
      candidate: q.candidate,
      reference: q.reference,
      delta: q.candidate - q.reference,
      ciLower: q.ci_lower,
      margin: q.margin,
      n: q.n,
      verifiers: q.verifiers,
      ts: q.ts,
    };
  });
}

export const pts = (frac: number, digits = 1) => `${frac >= 0 ? "+" : "−"}${Math.abs(frac * 100).toFixed(digits)}`;

/** The verdict in one sentence a judge can read. */
export function qualitySentence(r: QualityRow): string {
  const worst = r.ciLower * 100;
  const margin = (r.margin * 100).toFixed(1);
  const bound =
    worst >= 0
      ? `at least ${worst.toFixed(1)} points better than the reference`
      : `at most ${Math.abs(worst).toFixed(1)} points worse than the reference`;
  return r.verdict === "pass"
    ? `With 95% confidence this checkpoint is ${bound}. That is inside the ${margin}-point margin, so it passes.`
    : `It could be as much as ${Math.abs(worst).toFixed(1)} points worse than the reference. That is beyond the ${margin}-point margin, so it is rejected and earns nothing.`;
}

// ---------------------------------------------------------- settlement

export interface SettlementPart {
  key: string;
  label: string;
  providerId: string | null;
  micros: number;
  frac: number;
  kind: "payee" | "refund";
}

export interface SettlementView {
  budgetMicros: number;
  parts: SettlementPart[];
  payees: { providerId: string; steps: number; micros: number; microsPerStep: number | null }[];
  zeroPaid: { providerId: string; rejectedSteps: number; reason: string }[];
  refundMicros: number;
  /** sum(payees) + refund == budget, the same rule the contract enforces. */
  balanced: boolean;
}

/** 6-decimal USDC as a whole number, the same precision the contract uses, so sums are exact. */
const micros = (usdc: string) => Math.round(Number(usdc) * 1e6);

export function settlementView(s: DashboardState): SettlementView | null {
  const st = s.settlement;
  if (!st) return null;
  const budgetMicros = micros(st.budget_usdc);
  const refundMicros = micros(st.refund_usdc);
  const payees = st.payees.map((p) => ({
    providerId: p.provider_id,
    steps: p.accepted_steps,
    micros: micros(p.amount_usdc),
    microsPerStep: p.accepted_steps > 0 ? micros(p.amount_usdc) / p.accepted_steps : null,
  }));
  const paid = payees.reduce((a, p) => a + p.micros, 0);
  const frac = (m: number) => (budgetMicros > 0 ? m / budgetMicros : 0);
  const parts: SettlementPart[] = [
    ...payees
      .filter((p) => p.micros > 0)
      .map((p) => ({
        key: p.providerId,
        label: s.providers[p.providerId]?.name ?? `Provider ${p.providerId}`,
        providerId: p.providerId,
        micros: p.micros,
        frac: frac(p.micros),
        kind: "payee" as const,
      })),
    ...(refundMicros > 0
      ? [{ key: "refund", label: "Refund to client", providerId: null, micros: refundMicros, frac: frac(refundMicros), kind: "refund" as const }]
      : []),
  ];
  return {
    budgetMicros,
    parts,
    payees,
    zeroPaid: st.zero_paid.map((z) => ({ providerId: z.provider_id, rejectedSteps: z.rejected_steps, reason: z.reason })),
    refundMicros,
    balanced: paid + refundMicros === budgetMicros,
  };
}

/** At least 2 decimals, and more only when they carry value: 0.125 stays 0.125. */
export const usdc = (m: number) => {
  const exact = (m / 1e6).toFixed(6).replace(/0+$/, "");
  const [whole, part = ""] = exact.split(".");
  return `${whole}.${part.padEnd(2, "0")}`;
};
