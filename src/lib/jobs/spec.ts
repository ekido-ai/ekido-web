/**
 * New-job form: defaults, validation and the POST /jobs body (plan.md section E example).
 * Form values are strings (what inputs hold); `toRequest` converts once, after validation.
 */

export interface JobForm {
  template: "distilbert-lora-agnews/v1";
  logicalBatch: string;
  totalSteps: string;
  learningRate: string;
  seed: string;
  /** Accuracy floor for the final model, percent. */
  minAccuracyPct: string;
  /** Non-inferiority margin, accuracy points. */
  marginPts: string;
  budgetUsdc: string;
  deadlineMin: string;
}

export const defaultJob: JobForm = {
  template: "distilbert-lora-agnews/v1",
  logicalBatch: "32",
  totalSteps: "300",
  learningRate: "0.0005",
  seed: "1337",
  minAccuracyPct: "88",
  marginPts: "2",
  budgetUsdc: "5.00",
  deadlineMin: "30",
};

export type JobErrors = Partial<Record<keyof JobForm, string>>;

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function validateJob(f: JobForm): JobErrors {
  const e: JobErrors = {};
  const lb = num(f.logicalBatch);
  if (!Number.isInteger(lb) || lb < 1 || lb > 256 || (lb & (lb - 1)) !== 0)
    e.logicalBatch = "A power of two from 1 to 256, so every GPU can split it evenly into micro-batches";
  const steps = num(f.totalSteps);
  if (!Number.isInteger(steps) || steps < 10 || steps > 5000) e.totalSteps = "A whole number from 10 to 5000";
  const lr = num(f.learningRate);
  if (!(lr > 0 && lr <= 0.01)) e.learningRate = "Greater than 0 and at most 0.01";
  const seed = num(f.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 2 ** 31 - 1) e.seed = "A whole number from 0 to 2147483647";
  const acc = num(f.minAccuracyPct);
  if (!(acc >= 25 && acc <= 99)) e.minAccuracyPct = "From 25 to 99 percent (25% is random guessing on 4 classes)";
  const m = num(f.marginPts);
  if (!(m >= 0.5 && m <= 10))
    e.marginPts = "From 0.5 to 10 points. Below about 1 point the test mostly measures noise at this evaluation size";
  const b = num(f.budgetUsdc);
  if (!(b > 0 && b <= 100) || !/^\d+(\.\d{1,2})?$/.test(f.budgetUsdc.trim()))
    e.budgetUsdc = "More than 0 and at most 100 test USDC, with up to 2 decimals";
  const d = num(f.deadlineMin);
  if (!Number.isInteger(d) || d < 5 || d > 240) e.deadlineMin = "A whole number of minutes from 5 to 240";
  return e;
}

export interface CreateJobRequest {
  workload: {
    template: string;
    logical_batch_size: number;
    total_logical_steps: number;
    learning_rate: number;
    seed: number;
  };
  policy: {
    metric: "accuracy";
    min_absolute: number;
    non_inferiority_margin: number;
    confidence: 0.95;
  };
  budget_usdc: string;
  deadline_seconds: number;
}

export function toRequest(f: JobForm): CreateJobRequest {
  return {
    workload: {
      template: f.template,
      logical_batch_size: Number(f.logicalBatch),
      total_logical_steps: Number(f.totalSteps),
      learning_rate: Number(f.learningRate),
      seed: Number(f.seed),
    },
    policy: {
      metric: "accuracy",
      min_absolute: Number(f.minAccuracyPct) / 100,
      non_inferiority_margin: Number(f.marginPts) / 100,
      confidence: 0.95,
    },
    budget_usdc: Number(f.budgetUsdc).toFixed(2),
    deadline_seconds: Number(f.deadlineMin) * 60,
  };
}

/** What the budget buys at a given per-step price. */
export function costPreview(f: JobForm, pricePerStep: number) {
  const steps = num(f.totalSteps);
  const budget = num(f.budgetUsdc);
  if (!(steps > 0) || !(budget > 0) || !(pricePerStep > 0)) return null;
  const fullCost = steps * pricePerStep;
  return {
    fullCost,
    enough: budget + 1e-9 >= fullCost,
    refundIfAllAccepted: Math.max(0, budget - fullCost),
    stepsCovered: Math.min(steps, Math.floor(budget / pricePerStep + 1e-9)),
  };
}

export interface CreateJobResponse {
  job_id: string;
  onchain_id: `0x${string}`;
  state: string;
  spec_hash: `0x${string}`;
  policy_hash: `0x${string}`;
  next?: { action: string; contract: string | null };
  mock?: boolean;
}
