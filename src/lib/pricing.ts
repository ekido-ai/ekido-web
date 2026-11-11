/**
 * Market reference rates and the per-step conversion. See docs/business-model.md.
 *
 * Reference rates are third-party snapshots from Oct and Nov 2026, not our measurements, and move daily.
 * The RTX 3060 has no published figure in those sources, so its rate is our own estimate and says so.
 */

export interface GpuClass {
  id: string;
  label: string;
  /** Typical marketplace USDC per hour for one GPU. */
  marketHourly: number;
  source: string;
  /** Steps per second on our workload, when we have measured it ourselves. */
  measuredStepsPerS: number | null;
}

export const GPU_CLASSES: GpuClass[] = [
  { id: "rtx3060", label: "RTX 3060 (6 to 12 GB)", marketHourly: 0.1, source: "Our estimate: no public figure found; priced below the RTX 4090 range", measuredStepsPerS: 12 },
  { id: "rtx4090", label: "RTX 4090 (24 GB)", marketHourly: 0.55, source: "Vast.ai median, late Oct 2026 (joulemath.com)", measuredStepsPerS: null },
  { id: "a100", label: "A100 80 GB", marketHourly: 0.9, source: "Marketplace range $0.40 to $1.19 (Vast.ai, RunPod), Oct 2026", measuredStepsPerS: null },
  { id: "h100", label: "H100 80 GB", marketHourly: 1.9, source: "Marketplace range $1.50 to $2.99 (Vast.ai, RunPod), Oct 2026", measuredStepsPerS: null },
  { id: "cpu", label: "CPU only", marketHourly: 0.02, source: "Our estimate for a desktop CPU", measuredStepsPerS: null },
];

/** Suggested provider rate: a little under the market, so the client's total with the fee still lands below it. */
export const SUGGESTED_DISCOUNT = 0.15;
/** Proposed protocol fee on accepted work only, paid by the client on top. Not charged yet on the test network. */
export const PROPOSED_FEE_BPS = 800;

export function suggestedHourly(c: GpuClass): number {
  return Math.round(c.marketHourly * (1 - SUGGESTED_DISCOUNT) * 1000) / 1000;
}

/**
 * Hourly rate to the per-step price the coordinator and the on-chain commitment use: whole micro-USDC,
 * at least 1. Returns the effective hourly too, because 6 decimals make cheap fast GPUs round.
 */
export function perStepPrice(hourly: number, stepsPerS: number): { price: string; micros: number; effectiveHourly: number } | null {
  if (!(hourly > 0) || !(stepsPerS > 0) || hourly > 1000 || stepsPerS > 100_000) return null;
  const micros = Math.max(1, Math.round((hourly / (stepsPerS * 3600)) * 1_000_000));
  const price = (micros / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return { price, micros, effectiveHourly: (micros / 1_000_000) * stepsPerS * 3600 };
}

/** What a client pays per hour of accepted work, including the proposed fee. */
export function clientHourly(providerHourly: number): number {
  return providerHourly * (1 + PROPOSED_FEE_BPS / 10_000);
}
