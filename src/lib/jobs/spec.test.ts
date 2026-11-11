import { describe, expect, it } from "vitest";
import { costPreview, defaultJob, toRequest, validateJob } from "./spec";

describe("job form", () => {
  it("defaults are valid and match the plan's example request", () => {
    expect(validateJob(defaultJob)).toEqual({});
    expect(toRequest(defaultJob)).toEqual({
      workload: {
        template: "distilbert-lora-agnews/v1",
        logical_batch_size: 32,
        total_logical_steps: 300,
        learning_rate: 0.0005,
        seed: 1337,
      },
      policy: { metric: "accuracy", min_absolute: 0.88, non_inferiority_margin: 0.02, confidence: 0.95 },
      budget_usdc: "5.00",
      deadline_seconds: 1800,
    });
  });

  it("rejects a logical batch that can't be split evenly", () => {
    expect(validateJob({ ...defaultJob, logicalBatch: "24" }).logicalBatch).toBeDefined();
    expect(validateJob({ ...defaultJob, logicalBatch: "64" }).logicalBatch).toBeUndefined();
  });

  it("rejects bad numbers, blanks and too many decimals", () => {
    const e = validateJob({ ...defaultJob, totalSteps: "", marginPts: "0.1", budgetUsdc: "1.234", deadlineMin: "2.5" });
    expect(Object.keys(e).sort()).toEqual(["budgetUsdc", "deadlineMin", "marginPts", "totalSteps"]);
  });

  it("previews cost and flags a budget that can't cover every step", () => {
    expect(costPreview(defaultJob, 0.01)).toMatchObject({ enough: true, refundIfAllAccepted: 2 });
    expect(costPreview({ ...defaultJob, budgetUsdc: "2.00" }, 0.01)).toMatchObject({ enough: false, stepsCovered: 200 });
    expect(costPreview({ ...defaultJob, totalSteps: "x" }, 0.01)).toBeNull();
  });
});
