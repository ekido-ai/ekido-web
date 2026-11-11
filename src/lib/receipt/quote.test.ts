import { describe, expect, it } from "vitest";
import { quoteJob } from "./quote";

describe("quoteJob", () => {
  it("prices the job by steps and rate, refunding the rest", () => {
    expect(quoteJob(400, "0.003", "5")).toEqual({ max_usdc: "5.000000", expected_usdc: "1.200000", refund_if_done_usdc: "3.800000", refund_if_failed_usdc: "5.000000", fits_budget: true });
  });

  it("never charges more than the budget, and says so", () => {
    const q = quoteJob(6000, "0.003", "5");
    expect(q.expected_usdc).toBe("5.000000");
    expect(q.fits_budget).toBe(false);
  });
});
