import { fromMicros, toMicros } from "./receipt";

/** What a client can expect to pay before funding a job. Integer micro-USDC throughout. */
export interface Quote {
  max_usdc: string;
  expected_usdc: string;
  refund_if_done_usdc: string;
  refund_if_failed_usdc: string;
  fits_budget: boolean;
}

export function quoteJob(totalSteps: number, ratePerStepUsdc: string, budgetUsdc: string): Quote {
  const budget = toMicros(budgetUsdc);
  const expected = toMicros(ratePerStepUsdc) * BigInt(Math.max(0, Math.floor(totalSteps)));
  const charged = expected < budget ? expected : budget;
  return {
    max_usdc: fromMicros(budget),
    expected_usdc: fromMicros(charged),
    refund_if_done_usdc: fromMicros(budget - charged),
    // A refused final model refunds the whole budget, as the contract does today.
    refund_if_failed_usdc: fromMicros(budget),
    fits_budget: expected <= budget,
  };
}
