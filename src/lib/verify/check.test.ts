import { afterEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  config: { coordinatorUrl: "http://coordinator", rpcUrl: "http://rpc", chainId: 84532, explorer: null as string | null, escrowAddress: null as string | null },
  rpcChainId: 31337,
  tx: { to: `0x${"1".repeat(40)}`, input: "0x" },
  verdict: {} as Record<string, unknown>,
  job: {} as Record<string, unknown>,
}));

vi.mock("../config", () => ({ config: stubs.config }));
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    decodeFunctionData: () => ({ functionName: "submitAttestation", args: [stubs.verdict, []] }),
    createPublicClient: () => ({
      getChainId: async () => stubs.rpcChainId,
      getTransaction: async () => stubs.tx,
      getTransactionReceipt: async () => ({ status: "success", blockNumber: BigInt(1) }),
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "getJob") return stubs.job;
        if (functionName === "quorumOf") return BigInt(0);
        return `0x${"0".repeat(64)}`;
      },
    }),
  };
});

import { verifyPayout } from "./check";
import { lineageRoot } from "./payout";

afterEach(() => { vi.unstubAllGlobals(); });

describe("escrow identity", () => {
  it("refuses an RPC on the wrong chain", async () => {
    stubs.rpcChainId = 84532;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/settlement") ? { submit_tx: `0x${"e".repeat(64)}` } : {} })));
    try {
      await expect(verifyPayout("job", true)).rejects.toThrow("different chain");
    } finally {
      stubs.rpcChainId = 31337;
    }
  });
  it.each([
    [null, false],
    [`0x${"2".repeat(40)}`, false],
    [`0x${"1".repeat(40)}`, true],
  ])("checks the transaction destination against trusted configuration (%s)", async (configured, expected) => {
    stubs.config.escrowAddress = configured;
    const checkpoint = "a".repeat(64);
    const onchainId = `0x${"b".repeat(64)}`;
    stubs.verdict = { jobId: onchainId, finalCheckpoint: `0x${checkpoint}`, lineageRoot: lineageRoot([checkpoint]), payees: [], amounts: [], refund: BigInt(5) };
    stubs.job = { state: 5, verifierSet: 1, specHash: `0x${"c".repeat(64)}`, policyHash: `0x${"d".repeat(64)}`, finalCheckpoint: `0x${checkpoint}`, budget: BigInt(5), payees: [], amounts: [], refund: BigInt(5) };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => {
      if (url.endsWith("/settlement")) return { submit_tx: `0x${"e".repeat(64)}` };
      if (url.endsWith("/checkpoints")) return [{ manifest_hash: checkpoint, parent_hash: null, logical_step: 1, signer: "0x1" }];
      if (url.endsWith("/providers")) return [{ name: "A", enrolled_key: "0x1", wallet_address: `0x${"1".repeat(40)}`, price_per_step: "0" }];
      return { onchain_id: onchainId, spec_hash: "c".repeat(64), policy_hash: "d".repeat(64) };
    } })));
    const result = await verifyPayout("job", true);
    expect(result.rows.find((row) => row.title === "Escrow matches the configured address")?.passed).toBe(expected);
  });
});

describe("final on-chain split", () => {
  it("flags a post-attestation change even when the signed verdict is unchanged", async () => {
    stubs.config.escrowAddress = `0x${"1".repeat(40)}`;
    const checkpoint = "a".repeat(64);
    const onchainId = `0x${"b".repeat(64)}`;
    stubs.verdict = { jobId: onchainId, finalCheckpoint: `0x${checkpoint}`, lineageRoot: lineageRoot([checkpoint]), payees: [], amounts: [], refund: BigInt(5) };
    stubs.job = { state: 5, verifierSet: 1, specHash: `0x${"c".repeat(64)}`, policyHash: `0x${"d".repeat(64)}`, finalCheckpoint: `0x${checkpoint}`, budget: BigInt(5), payees: [], amounts: [], refund: BigInt(4) };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => {
      if (url.endsWith("/settlement")) return { submit_tx: `0x${"e".repeat(64)}` };
      if (url.endsWith("/checkpoints")) return [{ manifest_hash: checkpoint, parent_hash: null, logical_step: 1, signer: "0x1" }];
      if (url.endsWith("/providers")) return [{ name: "A", enrolled_key: "0x1", wallet_address: `0x${"1".repeat(40)}`, price_per_step: "0" }];
      return { onchain_id: onchainId, spec_hash: "c".repeat(64), policy_hash: "d".repeat(64) };
    } })));
    const result = await verifyPayout("job", true);
    expect(result.rows.find((row) => row.title === "Final on-chain split matches the signed verdict")?.passed).toBe(false);
  });
});
