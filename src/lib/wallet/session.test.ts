import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { buildMessage, checkSession, readMessage, type Session } from "./session";

// A throwaway key that exists only in this test.
const account = privateKeyToAccount("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
const DOMAIN = "gpuchain.duckdns.org";

async function session(over: Partial<{ domain: string; chainId: number; expiresAt: Date }> = {}): Promise<Session> {
  const expiresAt = over.expiresAt ?? new Date(Date.now() + 3600_000);
  const message = buildMessage({
    domain: over.domain ?? DOMAIN,
    uri: `https://${DOMAIN}`,
    address: account.address,
    chainId: over.chainId ?? 84532,
    nonce: "a1b2c3d4e5f60718",
    issuedAt: new Date(),
    expiresAt,
  });
  return { address: account.address, message, signature: await account.signMessage({ message }), expiresAt: expiresAt.getTime() };
}

describe("sign in with your wallet", () => {
  it("writes an EIP-4361 message and reads its fields back", async () => {
    const s = await session();
    expect(s.message.split("\n")[0]).toBe(`${DOMAIN} wants you to sign in with your Ethereum account:`);
    expect(readMessage(s.message)).toMatchObject({ domain: DOMAIN, address: account.address, chainId: 84532, nonce: "a1b2c3d4e5f60718" });
  });

  it("accepts a genuine, current session", async () => {
    expect(await checkSession(await session(), DOMAIN)).toBe(true);
  });

  it("refuses a session claiming another address", async () => {
    const s = await session();
    expect(await checkSession({ ...s, address: "0x000000000000000000000000000000000000dEaD" }, DOMAIN)).toBe(false);
  });

  it("refuses a message signed for another site, chain, or already expired", async () => {
    expect(await checkSession(await session({ domain: "evil.example" }), DOMAIN)).toBe(false);
    expect(await checkSession(await session({ chainId: 1 }), DOMAIN)).toBe(false);
    expect(await checkSession(await session({ expiresAt: new Date(Date.now() - 1000) }), DOMAIN)).toBe(false);
  });

  it("refuses an edited message or a stretched expiry", async () => {
    const s = await session();
    expect(await checkSession({ ...s, message: s.message.replace("Nonce: a1", "Nonce: b1") }, DOMAIN)).toBe(false);
    expect(await checkSession({ ...s, expiresAt: s.expiresAt + 3600_000 }, DOMAIN)).toBe(false);
  });
});
