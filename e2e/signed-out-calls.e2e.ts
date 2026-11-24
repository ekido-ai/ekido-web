import { expect, test, type Page } from "@playwright/test";
import { useFakeChain } from "./fake-chain";
import { ROUTES } from "./routes";

/**
 * ekido-ai/ekido-internal#93 (option 2, decided by Piyush on 24 Nov):
 * - pages other than the job screens make no job or provider calls;
 * - a signed-out visitor is never sent to the coordinator's private lists (/providers, /settlements, /chain/logs),
 *   so nothing is refused and nothing is logged as a 401;
 * - signed out, /chain reads the chain only when "Check on chain" is pressed (#94).
 * The last two depend on the coordinator being on the site's own host, so they run against staging (E2E_BASE_URL).
 *
 * Signed in, nothing changes for those lists: the coordinator's ApiGuard (ekido-coordinator, api_guard.py) opens them
 * only to its operator token and never reads the Platform session (PR review on ekido-ai/ekido-web#40). The signed-in
 * tests below run against the real guard, on staging. With JOURNEY_SESSION (a test account's `ekido_session` cookie,
 * see journey.e2e.ts) the Platform session is real. Without it, the Platform's `/v1/me` is answered in the browser for
 * a made-up account: the coordinator sees exactly the same requests either way, as it ignores the cookie.
 */

const REMOTE = Boolean(process.env.E2E_BASE_URL);
const PRIVATE = /\/(providers|settlements|chain\/logs)(\?|$)/;
const COORDINATOR_CALL = /\/(jobs|providers|settlements|chain\/logs)(\/|\?|$)/;
const RPC = /sepolia\.base\.org|publicnode\.com/;
const SESSION = process.env.JOURNEY_SESSION;

function watch(page: Page) {
  const seen = { coordinator: [] as string[], refused: [] as string[], getLogs: 0, me: [] as number[] };
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (RPC.test(url.host) || url.pathname.startsWith("/_next/")) return;
    if (url.pathname.endsWith("/v1/me")) seen.me.push(res.status());
    if (COORDINATOR_CALL.test(url.pathname)) seen.coordinator.push(url.pathname);
    if (res.status() === 401 || res.status() === 403) seen.refused.push(`${res.status()} ${url.pathname}`);
  });
  page.on("request", (req) => {
    if (!RPC.test(req.url()) || req.method() !== "POST") return;
    const body = req.postDataJSON() as { method?: string } | { method?: string }[];
    seen.getLogs += (Array.isArray(body) ? body : [body]).filter((c) => c?.method === "eth_getLogs").length;
  });
  return seen;
}

test.beforeEach(async ({ page }) => {
  // Live mode, where the job screens poll the coordinator. (Not `?source=live`: on / that opens /dashboard.)
  await page.addInitScript(() => {
    localStorage.setItem("ekido.notice", "1");
    localStorage.setItem("ekido.source", "live");
  });
  if (!REMOTE) await useFakeChain(page);
});

for (const path of ["/", "/pricing", "/developers", "/products/train", "/privacy", "/provide"]) {
  test(`${path} makes no job or provider calls`, async ({ page }) => {
    const seen = watch(page);
    await page.goto(path);
    await page.waitForTimeout(4_000);
    expect(seen.coordinator).toEqual([]);
  });
}

test("a job screen in live mode still reads jobs from the coordinator", async ({ page }) => {
  const seen = watch(page);
  await page.goto("/dashboard");
  await expect.poll(() => seen.coordinator.some((p) => /\/jobs(\/|$)/.test(p)), { timeout: 10_000 }).toBe(true);
});

test("signed out, no page asks for the coordinator's private lists or gets a 401", async ({ page }) => {
  test.skip(!REMOTE, "Needs the coordinator on the site's own host, as on staging.");
  test.setTimeout(240_000);
  const seen = watch(page);
  for (const path of ROUTES.filter((r) => r !== "/settings" && r !== "/admin")) {
    await page.goto(path);
    await page.waitForTimeout(2_500);
  }
  expect(seen.coordinator.filter((p) => PRIVATE.test(p))).toEqual([]);
  expect(seen.refused).toEqual([]);
});

test("signed out, /chain reads nothing until Check on chain is pressed", async ({ page }) => {
  test.skip(!REMOTE, "Needs the coordinator on the site's own host, as on staging.");
  test.setTimeout(150_000);
  const seen = watch(page);
  await page.goto("/chain");
  const check = page.getByRole("button", { name: "Check on chain" });
  await expect(check).toBeVisible();
  await page.waitForTimeout(3_000);
  expect(seen.getLogs).toBe(0);

  await check.click();
  await expect(page.getByText(/^\d+ of \d+ agree$|^Mismatch found$/).first()).toBeVisible({ timeout: 120_000 });
  expect(seen.getLogs).toBeGreaterThan(0);
  expect(seen.refused).toEqual([]);
});

/** Signs this page in: the account note, plus a real session (JOURNEY_SESSION) or a stand-in `/v1/me` (see the top). */
async function signIn(page: Page, baseURL: string) {
  await page.addInitScript(() => localStorage.setItem("ekido.account", "1"));
  if (SESSION) {
    await page.context().addCookies([{ name: "ekido_session", value: SESSION, url: baseURL, httpOnly: true, secure: baseURL.startsWith("https:"), sameSite: "Lax" }]);
  } else {
    await page.route(/\/v1\/me$/, (route) => route.fulfill({ json: { user_id: "e2e-signed-in", email: null, name: "E2E", orgs: [] } }));
  }
}

test.describe("signed in, against the coordinator's real authorization", () => {
  test.skip(!REMOTE, "Needs the coordinator on the site's own host, as on staging.");

  test("no page asks for the coordinator's private lists or gets a 401 from the coordinator", async ({ page, baseURL }) => {
    test.setTimeout(240_000);
    await signIn(page, baseURL!);
    const seen = watch(page);
    for (const path of ROUTES.filter((r) => r !== "/settings" && r !== "/admin")) {
      await page.goto(path);
      await page.waitForTimeout(2_500);
    }
    expect(seen.me.length, "the header asked who is signed in").toBeGreaterThan(0);
    expect(seen.me.every((s) => s === 200), `/v1/me answered ${seen.me.join(", ")}`).toBe(true);
    expect(seen.coordinator.filter((p) => PRIVATE.test(p))).toEqual([]);
    // With the stand-in, the Platform's other routes have no real session behind them, so only the coordinator's
    // answers are checked; with JOURNEY_SESSION, every answer is.
    expect(seen.refused.filter((r) => SESSION || !/\/v1\//.test(r))).toEqual([]);
  });

  test("/earnings says earnings are private, without a 401", async ({ page, baseURL }) => {
    await signIn(page, baseURL!);
    const seen = watch(page);
    await page.goto("/earnings");
    await expect(page.getByText("Earnings are private on this network")).toBeVisible({ timeout: 15_000 });
    expect(seen.coordinator.filter((p) => PRIVATE.test(p))).toEqual([]);
    expect(seen.refused.filter((r) => SESSION || !/\/v1\//.test(r))).toEqual([]);
  });

  test("/chain waits for Check on chain instead of trying the private log index", async ({ page, baseURL }) => {
    await signIn(page, baseURL!);
    const seen = watch(page);
    await page.goto("/chain");
    await expect(page.getByRole("button", { name: "Check on chain" })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3_000);
    expect(seen.coordinator.filter((p) => PRIVATE.test(p))).toEqual([]);
    expect(seen.getLogs).toBe(0);
  });
});
