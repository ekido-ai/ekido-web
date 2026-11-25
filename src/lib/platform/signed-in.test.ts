import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A Storage stand-in: vitest runs these tests without a browser. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let calls: string[];
let meStatus: number;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("localStorage", memoryStorage());
  calls = [];
  meStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(new URL(url).pathname);
      const body = meStatus === 200 ? { user_id: "u1", email: null, name: null, orgs: [] } : { error: "SIGN_IN_REQUIRED" };
      return new Response(JSON.stringify(body), { status: meStatus });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

/*
 * privateListsOpenTo against the coordinator's ApiGuard (ekido-coordinator, api_guard.py). A browser never holds the
 * operator token, so the guard answers it only on loopback with no proxy in between, and the Platform session plays
 * no part. Each case names the guard's answer to the page.
 */
describe("privateListsOpenTo follows the coordinator's ApiGuard", () => {
  const cases: [string, string, string, boolean][] = [
    ["staging: same host, behind Caddy (X-Forwarded-For), 401", "https://ekido-staging.duckdns.org/sepolia", "https://ekido-staging.duckdns.org/earnings", false],
    ["a relative coordinator URL on the site's host, 401", "/sepolia", "https://ekido.example/chain", false],
    ["a same-origin proxy on this machine still forwards, 401", "http://127.0.0.1:3104/sepolia", "http://127.0.0.1:3104/chain", false],
    ["a coordinator on another public host, no token, 401", "https://coordinator.ekido.example", "https://ekido.example/chain", false],
    ["a coordinator on a LAN address, not loopback, 401", "http://192.168.1.20:8000", "http://192.168.1.20:3000/chain", false],
    ["the e2e mock on 127.0.0.1, reached directly, answers", "http://127.0.0.1:8787", "http://127.0.0.1:3100/chain", true],
    ["the local default, localhost:8000, answers", "http://localhost:8000", "http://localhost:3000/earnings", true],
    ["IPv6 loopback answers", "http://[::1]:8000", "http://[::1]:3000/chain", true],
    ["a bad URL is treated as closed", "not a url", "also not", false],
  ];
  it.each(cases)("%s", async (_name, coordinator, site, open) => {
    const { privateListsOpenTo } = await import("./signed-in");
    expect(privateListsOpenTo(coordinator, site)).toBe(open);
  });

  it("doesn't depend on a signed-in account, and asks the Platform nothing", async () => {
    localStorage.setItem("ekido.account", "1");
    const { privateListsOpenTo } = await import("./signed-in");
    expect(privateListsOpenTo("https://ekido-staging.duckdns.org/sepolia", "https://ekido-staging.duckdns.org/earnings")).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("the account note follows sign-in and sign-out", () => {
  it("is set by a successful /v1/me and an email sign-in, and removed by sign-out", async () => {
    const { platform } = await import("./api");
    await platform.me();
    expect(localStorage.getItem("ekido.account")).toBe("1");
    await platform.signOut();
    expect(localStorage.getItem("ekido.account")).toBeNull();
    await platform.verifyEmailSignIn("token");
    expect(localStorage.getItem("ekido.account")).toBe("1");
  });

  it("is removed when sign-out fails, so the next page doesn't ask for private lists", async () => {
    localStorage.setItem("ekido.account", "1");
    meStatus = 500;
    const { platform } = await import("./api");
    await expect(platform.signOut()).rejects.toThrow();
    expect(localStorage.getItem("ekido.account")).toBeNull();
  });
});

describe("currentAccount, for the header's account link", () => {
  it("is null with no request when this browser never signed in", async () => {
    const { currentAccount } = await import("./signed-in");
    expect(await currentAccount()).toBeNull();
    expect(calls).toEqual([]);
  });

  it("is the account from /v1/me when the note is there", async () => {
    localStorage.setItem("ekido.account", "1");
    const { currentAccount } = await import("./signed-in");
    expect(await currentAccount()).toMatchObject({ user_id: "u1" });
  });

  it("is null, and drops the note, when the session has ended", async () => {
    localStorage.setItem("ekido.account", "1");
    meStatus = 401;
    const { currentAccount } = await import("./signed-in");
    expect(await currentAccount()).toBeNull();
    expect(localStorage.getItem("ekido.account")).toBeNull();
  });
});
