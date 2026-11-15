import { describe, expect, it } from "vitest";
import { emptyState, type DashboardState } from "../events/reduce";
import { expectedPayouts, lineageOf, stepsBySigner, type CheckpointRow, type ProviderTerms } from "../verify/payout";
import { buildReceipt, toMicros } from "./receipt";

// Two providers, one checkpoint chain. /verify recomputes the payout from the chain and the rates;
// the receipt is built from what the settlement says. The two must agree to the micro-USDC.
const HASH = (n: number) => n.toString(16).padStart(64, "0");
const KEY_A = "0x" + "aa".repeat(20);
const KEY_B = "0x" + "bb".repeat(20);
const WALLET_A = "0x" + "11".repeat(20);
const WALLET_B = "0x" + "22".repeat(20);

const rows: CheckpointRow[] = [
  { manifest_hash: HASH(1), parent_hash: null, logical_step: 150, signer: KEY_A },
  { manifest_hash: HASH(2), parent_hash: HASH(1), logical_step: 400, signer: KEY_B },
  // A rejected branch the final checkpoint does not descend from: it earns nothing.
  { manifest_hash: HASH(3), parent_hash: HASH(1), logical_step: 300, signer: KEY_A },
];

const providers: ProviderTerms[] = [
  { name: "Provider A", wallet_address: WALLET_A, enrolled_key: KEY_A, price_per_step: "0.001" },
  { name: "Provider B", wallet_address: WALLET_B, enrolled_key: KEY_B, price_per_step: "0.003" },
];

describe("the receipt matches what /verify recomputes", () => {
  const steps = stepsBySigner(lineageOf(rows, HASH(2)));
  const verified = expectedPayouts(steps, providers, toMicros("5"));

  const state = {
    ...emptyState,
    jobId: "job-1",
    providers: { a: { name: "Provider A" }, b: { name: "Provider B" } },
    settlement: {
      payees: [
        { provider_id: "a", accepted_steps: 150, amount_usdc: "0.15" },
        { provider_id: "b", accepted_steps: 250, amount_usdc: "0.75" },
      ],
      zero_paid: [],
      refund_usdc: "4.1",
      budget_usdc: "5",
    },
    chain: [],
  } as unknown as DashboardState;

  it("pays the same amount to each provider", () => {
    const receipt = buildReceipt(state, "2026-11-14T00:00:00Z")!;
    const byName = new Map(receipt.lines.map((l) => [l.provider, toMicros(l.amount_usdc)]));
    expect(byName.get("Provider A")).toBe(verified.get(WALLET_A));
    expect(byName.get("Provider B")).toBe(verified.get(WALLET_B));
  });

  it("pays the same total and leaves the same refund", () => {
    const receipt = buildReceipt(state, "2026-11-14T00:00:00Z")!;
    const paid = [...verified.values()].reduce((a, b) => a + b, BigInt(0));
    expect(toMicros(receipt.totals.paid_usdc)).toBe(paid);
    expect(toMicros(receipt.totals.refund_usdc)).toBe(toMicros("5") - paid);
    expect(receipt.totals.balanced).toBe(true);
  });

  it("would show a difference if the receipt paid a different amount", () => {
    const off = {
      ...state,
      settlement: { ...state.settlement!, payees: [{ provider_id: "a", accepted_steps: 150, amount_usdc: "0.16" }, state.settlement!.payees[1]] },
    } as DashboardState;
    const receipt = buildReceipt(off, "t")!;
    const a = receipt.lines.find((l) => l.provider === "Provider A")!;
    expect(toMicros(a.amount_usdc)).not.toBe(verified.get(WALLET_A));
  });
});
