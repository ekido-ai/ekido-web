import { describe, expect, it } from "vitest";
import { providerLedger } from "./ledger";
import type { Receipt } from "./receipt";

const receipt = (lines: Receipt["lines"], unpaid: Receipt["unpaid"] = []): Receipt => ({
  kind: "gpuchain.settlement_receipt.v1", job_id: "j", issued_at: "t", source: "recorded", currency: "USDC (test tokens)", network: "anvil",
  lines, unpaid, totals: { paid_usdc: "0", refund_usdc: "0", budget_usdc: "0", balanced: true }, transactions: [], notes: [],
});

describe("providerLedger", () => {
  it("adds up each provider's earnings across jobs, exactly, highest first", () => {
    const ledger = providerLedger([
      receipt([{ provider: "A", provider_id: "a", accepted_steps: 150, rate_per_step_usdc: "0.001", amount_usdc: "0.15" }, { provider: "B", provider_id: "b", accepted_steps: 250, rate_per_step_usdc: "0.003", amount_usdc: "0.75" }], [{ provider: "P", provider_id: "p", rejected_steps: 50, reason: "quality" }]),
      receipt([{ provider: "A", provider_id: "a", accepted_steps: 100, rate_per_step_usdc: "0.001", amount_usdc: "0.1" }]),
    ]);
    expect(ledger.map((r) => [r.provider, r.earned_usdc, r.paid_jobs, r.accepted_steps])).toEqual([
      ["B", "0.750000", 1, 250],
      ["A", "0.250000", 2, 250],
      ["P", "0.000000", 0, 0],
    ]);
    expect(ledger[2]).toMatchObject({ unpaid_jobs: 1, rejected_steps: 50 });
  });
});

import { earningsFromSettlements } from "./ledger";

describe("earningsFromSettlements", () => {
  it("counts only settled jobs, in base units, per wallet", () => {
    const rows = earningsFromSettlements(
      [
        { job_id: "1", status: "SETTLED", verdict: { payees: ["0xA", "0xB"], amounts: [150000, "750000"] } },
        { job_id: "2", status: "SETTLED", verdict: { payees: ["0xa"], amounts: [100000] } },
        { job_id: "3", status: "AWAITING_SIGNATURES", verdict: { payees: ["0xa"], amounts: [999999] } },
      ],
      new Map([["0xa", "Provider A"], ["0xb", "Provider B"]]),
    );
    expect(rows).toEqual([
      { wallet: "0xb", provider: "Provider B", paid_jobs: 1, earned_usdc: "0.750000" },
      { wallet: "0xa", provider: "Provider A", paid_jobs: 2, earned_usdc: "0.250000" },
    ]);
  });

  it("rejects missing or imprecise amounts instead of displaying a partial total", () => {
    expect(() => earningsFromSettlements([{ job_id: "1", status: "SETTLED", verdict: { payees: ["0xa"], amounts: [] } }], new Map())).toThrow("incomplete");
    expect(() => earningsFromSettlements([{ job_id: "1", status: "SETTLED", verdict: { payees: ["0xa"], amounts: [Number.MAX_SAFE_INTEGER + 1] } }], new Map())).toThrow("imprecise");
  });
});
