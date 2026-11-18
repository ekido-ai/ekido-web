import type { Page, Route } from "@playwright/test";
import { encodeAbiParameters, numberToHex, toFunctionSelector, type Hex } from "viem";

/**
 * A stand-in for the public Base Sepolia RPCs, so browser tests don't depend on someone else's server
 * (they rate-limit with 429 and can be down). It answers an escrow with no history and nothing held,
 * which reconciles cleanly: every total is zero and there are no events.
 *
 * FAKE_BLOCK must match the block the mock coordinator's /chain/logs reports as synced
 * (replay/mock-coordinator.mts), so /chain takes the index path with no un-indexed tail to read.
 */
export const FAKE_BLOCK = 60_000_000;
const CHAIN_ID = 84532;
const RPC_HOSTS = /^https:\/\/(sepolia\.base\.org|base-sepolia-rpc\.publicnode\.com)\//;

const ROLE = "0x00000000000000000000000000000000000000e1";
const word = (type: "address" | "uint256" | "uint32", value: unknown) => encodeAbiParameters([{ type }], [value as never]);

const CALLS: Record<Hex, Hex> = Object.fromEntries(
  (
    [
      ["function owner()", word("address", ROLE)],
      ["function coordinator()", word("address", ROLE)],
      ["function arbiter()", word("address", ROLE)],
      ["function currentVerifierSet()", word("uint32", 1)],
      ["function quorumOf(uint32)", word("uint256", BigInt(1))],
      ["function disputeBond()", word("uint256", BigInt(1_000_000))],
      ["function totalLocked()", word("uint256", BigInt(0))],
      ["function totalWithdrawable()", word("uint256", BigInt(0))],
      ["function withdrawable(address)", word("uint256", BigInt(0))],
      ["function balanceOf(address)", word("uint256", BigInt(0))],
    ] as const
  ).map(([signature, result]) => [toFunctionSelector(signature), result]),
);

type Request = { id: number; method: string; params?: unknown[] };

function answer({ id, method, params }: Request) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  switch (method) {
    case "eth_chainId": return ok(numberToHex(CHAIN_ID));
    case "eth_blockNumber": return ok(numberToHex(FAKE_BLOCK));
    case "eth_getLogs": return ok([]);
    case "eth_getBalance": return ok(numberToHex(BigInt(10) ** BigInt(16)));
    case "eth_getCode": return ok("0x6080604052");
    case "eth_call": {
      const data = ((params?.[0] as { data?: Hex; input?: Hex })?.data ?? (params?.[0] as { input?: Hex })?.input ?? "0x") as Hex;
      const result = CALLS[data.slice(0, 10) as Hex];
      if (result) return ok(result);
      break;
    }
  }
  // Something the fake doesn't know: fail loudly so the test points at it instead of passing on a guess.
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `fake-chain: no answer for ${method} ${JSON.stringify(params ?? [])}` } };
}

/**
 * Sends this page's Base Sepolia RPC traffic to the fake. Returns the calls it couldn't answer, which a test should
 * expect to be empty: a page may swallow an RPC error and still render, so the test has to look for them itself.
 */
export async function useFakeChain(page: Page): Promise<string[]> {
  const unanswered: string[] = [];
  await page.route(RPC_HOSTS, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    const body = route.request().postDataJSON() as Request | Request[];
    const reply = Array.isArray(body) ? body.map(answer) : answer(body);
    for (const r of Array.isArray(reply) ? reply : [reply]) if ("error" in r) unanswered.push(r.error.message);
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, json: reply });
  });
  return unanswered;
}
