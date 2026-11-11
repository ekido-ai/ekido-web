import { describe, expect, it } from "vitest";
import { emptyState, type DashboardState } from "../events/reduce";
import { buildReceipt, fromMicros, receiptCsv, toMicros } from "./receipt";

const state = {
  ...emptyState,
  jobId: "job-1",
  providers: { a: { name: "Provider A" }, b: { name: "Provider B" }, p: { name: "Provider P" } },
  settlement: {
    payees: [
      { provider_id: "a", accepted_steps: 150, amount_usdc: "0.15" },
      { provider_id: "b", accepted_steps: 250, amount_usdc: "0.75" },
    ],
    zero_paid: [{ provider_id: "p", rejected_steps: 50, reason: "quality test failed" }],
    refund_usdc: "4.1",
    budget_usdc: "5",
  },
  chain: [{ kind: "finalize", status: "confirmed", tx_hash: "0xabc", chain: "anvil", explorer_url: null, ts: "t" }],
} as unknown as DashboardState;

describe("money maths", () => {
  it("round-trips USDC strings exactly, with no float drift", () => {
    expect(fromMicros(toMicros("0.1") + toMicros("0.2"))).toBe("0.300000");
    expect(fromMicros(toMicros("4.100000"))).toBe("4.100000");
    expect(fromMicros(toMicros("-0.15"))).toBe("-0.150000");
    expect(() => toMicros("1.0000009")).toThrow("Invalid USDC amount");
    expect(() => toMicros("1.2.3")).toThrow("Invalid USDC amount");
  });
});

describe("buildReceipt", () => {
  it("itemises each payout with its rate, and balances exactly", () => {
    const r = buildReceipt(state, "2026-11-07T00:00:00Z")!;
    expect(r.lines.map((l) => [l.provider, l.amount_usdc, l.rate_per_step_usdc])).toEqual([
      ["Provider A", "0.150000", "0.001000"],
      ["Provider B", "0.750000", "0.003000"],
    ]);
    expect(r.totals).toEqual({ paid_usdc: "0.900000", refund_usdc: "4.100000", budget_usdc: "5.000000", balanced: true });
    expect(r.unpaid[0]).toMatchObject({ provider: "Provider P", rejected_steps: 50 });
    expect(r.network).toBe("anvil");
  });

  it("says plainly when the numbers don't add up", () => {
    const off = { ...state, settlement: { ...state.settlement!, refund_usdc: "4.0" } } as DashboardState;
    const receipt = buildReceipt(off, "t")!;
    expect(receipt.totals.balanced).toBe(false);
    expect(receiptCsv(receipt)).toContain("DOES NOT BALANCE");
  });

  it("has nothing to issue before settlement", () => {
    expect(buildReceipt(emptyState, "t")).toBeNull();
  });
});

describe("receiptCsv", () => {
  it("quotes text that would break a spreadsheet", () => {
    const tricky = { ...state, providers: { ...state.providers, a: { name: 'A, "fast"' } } } as unknown as DashboardState;
    expect(receiptCsv(buildReceipt(tricky, "t")!)).toContain('"A, ""fast"""');
  });

  it("labels recorded exports and neutralizes spreadsheet formulas in provider names", () => {
    const tricky = { ...state, providers: { ...state.providers, a: { name: "=1+1" } } } as unknown as DashboardState;
    const receipt = buildReceipt(tricky, "2026-11-07T00:00:00Z", "recorded")!;
    expect(receipt.source).toBe("recorded");
    expect(receiptCsv(receipt)).toContain("'=1+1");
    expect(receiptCsv(receipt)).toContain("recorded; network: anvil");
    expect(receipt.notes.join(" ")).toContain("does not prove the final split");
  });
});
