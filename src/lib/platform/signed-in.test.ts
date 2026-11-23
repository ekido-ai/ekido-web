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

describe("coordinatorOnSite", () => {
  it("is true for the public deployments' same-host coordinator", async () => {
    const { coordinatorOnSite } = await import("./signed-in");
    expect(coordinatorOnSite("https://ekido-staging.duckdns.org/sepolia", "https://ekido-staging.duckdns.org/chain")).toBe(true);
    expect(coordinatorOnSite("/sepolia", "https://ekido.example/chain")).toBe(true);
  });
  it("is false for a coordinator on another origin (local demo or test)", async () => {
    const { coordinatorOnSite } = await import("./signed-in");
    expect(coordinatorOnSite("http://127.0.0.1:8787", "http://127.0.0.1:3100/chain")).toBe(false);
    expect(coordinatorOnSite("not a url", "also not")).toBe(false);
  });
});

describe("accountSignedIn (ekido-ai/ekido-internal#93)", () => {
  it("answers no without asking /v1/me when this browser never signed in", async () => {
    const { accountSignedIn } = await import("./signed-in");
    expect(await accountSignedIn()).toBe(false);
    expect(calls).toEqual([]);
  });

  it("asks /v1/me once when the account note is there, and shares the answer", async () => {
    localStorage.setItem("ekido.account", "1");
    const { accountSignedIn } = await import("./signed-in");
    const [a, b] = await Promise.all([accountSignedIn(), accountSignedIn()]);
    expect([a, b]).toEqual([true, true]);
    expect(await accountSignedIn()).toBe(true);
    expect(calls.filter((c) => c.endsWith("/v1/me"))).toHaveLength(1);
  });

  it("drops the note when /v1/me says nobody is signed in, so it isn't asked again", async () => {
    localStorage.setItem("ekido.account", "1");
    meStatus = 401;
    const { accountSignedIn } = await import("./signed-in");
    expect(await accountSignedIn()).toBe(false);
    expect(localStorage.getItem("ekido.account")).toBeNull();
    expect(await accountSignedIn()).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("keeps the note on a network failure, which says nothing about the session", async () => {
    localStorage.setItem("ekido.account", "1");
    meStatus = 503;
    const { accountSignedIn } = await import("./signed-in");
    expect(await accountSignedIn()).toBe(false);
    expect(localStorage.getItem("ekido.account")).toBe("1");
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
