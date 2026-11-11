import { describe, expect, it } from "vitest";
import { expectedPayouts, lineageOf, lineageRoot, stepsBySigner, type CheckpointRow } from "./payout";

const row = (hash: string, parent: string | null, step: number, signer: string): CheckpointRow => ({ manifest_hash: hash, parent_hash: parent, logical_step: step, signer });

describe("lineageRoot", () => {
  it("matches gpuchain_core.settlement.lineage_root byte for byte", () => {
    expect(lineageRoot(["a".repeat(64), "b".repeat(64)])).toBe("0x6ad77461090b1815c3fe526647f27e76a16741cda358f04f492ecfd5ca887bd1");
    expect(lineageRoot(["1".repeat(64)])).toBe("0xf329e941dcdeba268c2bb37de9ac6a7db4855fddc715df9c387c724fc7a22553");
  });
});

describe("lineageOf", () => {
  const rows = [row("aa", null, 100, "0xA"), row("bb", "aa", 150, "0xA"), row("xx", "bb", 200, "0xP"), row("cc", "bb", 400, "0xB")];

  it("follows parents from the final checkpoint and leaves a rejected branch out", () => {
    expect(lineageOf(rows, "0xcc").map((r) => r.manifest_hash)).toEqual(["aa", "bb", "cc"]);
  });

  it("refuses a broken chain", () => {
    expect(() => lineageOf([row("cc", "gone", 400, "0xB")], "cc")).toThrow(/missing/);
  });

  it("refuses a loop", () => {
    expect(() => lineageOf([row("aa", "bb", 1, "0xA"), row("bb", "aa", 2, "0xA")], "aa")).toThrow(/loops/);
  });
});

describe("expectedPayouts", () => {
  const providers = [
    { name: "A", enrolled_key: "0xa", wallet_address: "0xWA", price_per_step: "0.001000" },
    { name: "B", enrolled_key: "0xb", wallet_address: "0xWB", price_per_step: "0.003000" },
  ];

  it("pays by accepted steps times rate, to the provider's wallet", () => {
    const steps = stepsBySigner([row("1", null, 150, "0xa"), row("2", "1", 400, "0xb")]);
    const paid = expectedPayouts(steps, providers, BigInt(5_000_000));
    expect(paid.get("0xwa")).toBe(BigInt(150_000));
    expect(paid.get("0xwb")).toBe(BigInt(750_000));
  });

  it("adds up work signed before and after an agent restarted", () => {
    const restarted = [{ name: "A", enrolled_key: "0xnew", signing_keys: ["0xnew", "0xold"], wallet_address: "0xWA", price_per_step: "0.001000" }];
    const paid = expectedPayouts(new Map([["0xold", 100], ["0xnew", 50]]), restarted, BigInt(5_000_000));
    expect(paid.get("0xwa")).toBe(BigInt(150_000));
  });

  it("stops at the budget", () => {
    const paid = expectedPayouts(new Map([["0xa", 100], ["0xb", 100]]), providers, BigInt(150_000));
    expect(paid.get("0xwa")).toBe(BigInt(100_000));
    expect(paid.get("0xwb")).toBe(BigInt(50_000));
  });

  it("refuses a signer no provider enrolled", () => {
    expect(() => expectedPayouts(new Map([["0xdead", 1]]), providers, BigInt(1))).toThrow(/enrolled/);
  });
});
