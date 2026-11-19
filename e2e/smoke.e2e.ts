import { expect, test } from "@playwright/test";
import { PRODUCTS } from "../src/lib/landing/products";
import { useFakeChain } from "./fake-chain";

/**
 * Page smoke tests (ticket P1): one test per route under src/app/.
 * Each test checks the page loads with status 200, has no console errors, shows its main heading
 * and doesn't scroll sideways. The "phone" project (Pixel 7, 412 px) and a 375 px pass below cover small screens.
 *
 * A route that fails because of a real bug stays in the list with `knownBug` set to the issue number,
 * so the test is marked test.fail() and turns red again (as "unexpectedly passed") once the bug is fixed.
 */
type Route = { path: string; knownBug?: string };

/**
 * Against the local build, Base Sepolia RPC traffic goes to a fake (e2e/fake-chain.ts) so the run doesn't depend on
 * public servers that rate-limit. Against staging (E2E_BASE_URL) the real chain is read, as users see it.
 */
const REMOTE = Boolean(process.env.E2E_BASE_URL);

const ROUTES: Route[] = [
  { path: "/" },
  { path: "/account" },
  { path: "/admin" },
  { path: "/chain" },
  { path: "/dashboard", knownBug: "ekido-ai/ekido-internal#92" }, // No <h1> in the Mission control view.
  { path: "/developers" },
  { path: "/earnings" },
  { path: "/help" },
  { path: "/jobs/new" },
  { path: "/kit" },
  { path: "/pricing" },
  { path: "/privacy" },
  ...PRODUCTS.map((p) => ({ path: `/products/${p.key}` })),
  { path: "/provide" },
  { path: "/quality" },
  { path: "/recovery" },
  { path: "/replay" },
  { path: "/roadmap" },
  { path: "/security" },
  { path: "/settlement" },
  { path: "/solutions" },
  { path: "/status" },
  { path: "/terms" },
  { path: "/trust" },
  { path: "/verify" },
];

for (const route of ROUTES) {
  test(`${route.path} loads cleanly`, async ({ page }) => {
    if (route.knownBug) test.fail(true, `known bug ${route.knownBug}`);

    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const unanswered = REMOTE ? [] : await useFakeChain(page);
    page.on("pageerror", (error) => errors.push(error.message));
    // "Failed to load resource" console errors don't name the URL, so record failing responses alongside them.
    const badResponses: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
    });

    // The ticket asks for no sideways scroll at 375 px, narrower than the Pixel 7 profile.
    if (test.info().project.name === "phone") await page.setViewportSize({ width: 375, height: 812 });

    const response = await page.goto(route.path);
    expect(response?.status(), "HTTP status").toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first(), "main heading").toBeVisible();

    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "the page scrolls sideways").toBeLessThanOrEqual(0);
    expect(unanswered, "RPC calls the fake chain couldn't answer (add them to e2e/fake-chain.ts)").toEqual([]);
    expect(errors, `console errors (failing responses: ${[...new Set(badResponses)].join(", ") || "none"})`).toEqual([]);
  });
}

// /chain has two ways to read history: the coordinator's index (one request) or a scan of the chain. The smoke
// test above only proves the page loads; this proves the index path is taken and its result reconciles.
test("/chain reads history from the index and reconciles", async ({ page }) => {
  test.skip(REMOTE, "Needs the mock coordinator's index and the fake chain.");
  const unanswered = await useFakeChain(page);
  const indexCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/chain/logs") indexCalls.push(request.url());
  });

  await page.goto("/chain");
  await expect(page.getByText(/Event history came from our index in one request/)).toBeVisible();
  await expect(page.getByText(/^\d+ of \d+ agree$/)).toBeVisible();
  expect(indexCalls, "one request to the index").toHaveLength(1);
  expect(unanswered, "RPC calls the fake chain couldn't answer").toEqual([]);
});
