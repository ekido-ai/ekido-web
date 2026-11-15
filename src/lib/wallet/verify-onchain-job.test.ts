import { describe, expect, it } from "vitest";
import { verifyOnchainJob, type OnchainJob } from "./escrow";
import type { PreparedSignedRequest } from "../jobs/signed-request";

const CLIENT = "0x1c4d04718d0fe1fcb23052ccee2fe5d2d8fc337f" as const;
const OTHER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;
const SPEC = "0x" + "11".repeat(32);
const POLICY = "0x" + "22".repeat(32);
const NOW = 1_800_000_000;

const prepared = { body: { budget_usdc: "4.00" }, specHash: SPEC, policyHash: POLICY } as unknown as PreparedSignedRequest;

const job = (over: Partial<OnchainJob> = {}): OnchainJob => ({
  client: CLIENT,
  state: 1,
  specHash: SPEC,
  policyHash: POLICY,
  budget: BigInt(4_000_000),
  disputeWindow: BigInt(3600),
  deadline: BigInt(NOW + 3600),
  ...over,
});

describe("verifyOnchainJob", () => {
  it("says a job that does not exist yet is not funded", () => {
    expect(verifyOnchainJob(job({ state: 0, client: OTHER, budget: BigInt(0) }), prepared, CLIENT, NOW)).toBe(false);
  });

  it("accepts a funded job that is exactly the signed request", () => {
    expect(verifyOnchainJob(job(), prepared, CLIENT, NOW)).toBe(true);
    expect(verifyOnchainJob(job({ state: 2 }), prepared, CLIENT, NOW)).toBe(true);
  });

  it("compares the client address without caring about letter case", () => {
    expect(verifyOnchainJob(job({ client: CLIENT.toUpperCase().replace("0X", "0x") as `0x${string}` }), prepared, CLIENT, NOW)).toBe(true);
  });

  it("refuses a different client, spec, policy or budget under the same id", () => {
    expect(() => verifyOnchainJob(job({ client: OTHER }), prepared, CLIENT, NOW)).toThrow(/differs/);
    expect(() => verifyOnchainJob(job({ specHash: "0x" + "99".repeat(32) }), prepared, CLIENT, NOW)).toThrow(/differs/);
    expect(() => verifyOnchainJob(job({ policyHash: "0x" + "99".repeat(32) }), prepared, CLIENT, NOW)).toThrow(/differs/);
    expect(() => verifyOnchainJob(job({ budget: BigInt(3_999_999) }), prepared, CLIENT, NOW)).toThrow(/differs/);
    expect(() => verifyOnchainJob(job({ budget: BigInt(4_000_001) }), prepared, CLIENT, NOW)).toThrow(/differs/);
  });

  it("refuses a dispute window that is too short for a public chain", () => {
    expect(() => verifyOnchainJob(job({ disputeWindow: BigInt(10) }), prepared, CLIENT, NOW)).toThrow(/differs/);
  });

  it("refuses a job that has left the funding stage", () => {
    expect(() => verifyOnchainJob(job({ state: 3 }), prepared, CLIENT, NOW)).toThrow(/left the funding stage/);
    expect(() => verifyOnchainJob(job({ state: 5 }), prepared, CLIENT, NOW)).toThrow(/left the funding stage/);
  });

  it("refuses an escrow whose deadline has passed, including exactly at the deadline", () => {
    expect(() => verifyOnchainJob(job({ deadline: BigInt(NOW - 1) }), prepared, CLIENT, NOW)).toThrow(/deadline has passed/);
    expect(() => verifyOnchainJob(job({ deadline: BigInt(NOW) }), prepared, CLIENT, NOW)).toThrow(/deadline has passed/);
    expect(verifyOnchainJob(job({ deadline: BigInt(NOW + 1) }), prepared, CLIENT, NOW)).toBe(true);
  });
});
