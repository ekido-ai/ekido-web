import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbi, parseAbiParameters } from "viem";

const stub = vi.hoisted(() => ({ chainId: 84532, status: "success", logs: [] as unknown[] }));
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return { ...actual, createPublicClient: () => ({
    getChainId: async () => stub.chainId,
    getTransactionReceipt: async () => ({ status: stub.status, blockNumber: BigInt(42), logs: stub.logs }),
  }) };
});

import { verifyWithdrawal } from "./withdrawal";
const wallet = `0x${"1".repeat(40)}` as const;
const escrow = `0x${"2".repeat(40)}` as const;
const hash = `0x${"3".repeat(64)}` as const;
const abi = parseAbi(["event Withdrawal(address indexed account, uint256 amount)"]);
const log = (address = escrow) => ({ address, topics: encodeEventTopics({ abi, eventName: "Withdrawal", args: { account: wallet } }), data: encodeAbiParameters(parseAbiParameters("uint256"), [BigInt(1_500_000)]) });

afterEach(() => { stub.chainId = 84532; stub.status = "success"; stub.logs = []; });

describe("withdrawal proof", () => {
  it("reads the recipient and amount from the configured escrow's successful receipt", async () => {
    stub.logs = [log()];
    const proof = await verifyWithdrawal(hash, wallet, escrow, "http://rpc", 84532);
    expect(proof.amount).toBe(BigInt(1_500_000));
    expect(proof.blockNumber).toBe(BigInt(42));
  });

  it("rejects wrong chain, failed transactions, and unrelated escrow logs", async () => {
    stub.chainId = 1;
    await expect(verifyWithdrawal(hash, wallet, escrow, "http://rpc", 84532)).rejects.toThrow("different chain");
    stub.chainId = 84532;
    stub.status = "reverted";
    await expect(verifyWithdrawal(hash, wallet, escrow, "http://rpc", 84532)).rejects.toThrow("did not succeed");
    stub.status = "success";
    stub.logs = [log(`0x${"4".repeat(40)}`)];
    await expect(verifyWithdrawal(hash, wallet, escrow, "http://rpc", 84532)).rejects.toThrow("No withdrawal");
  });

  it("refuses to trust a transaction without a configured escrow", async () => {
    await expect(verifyWithdrawal(hash, wallet, null, "http://rpc", 84532)).rejects.toThrow("trusted escrow");
  });
});
