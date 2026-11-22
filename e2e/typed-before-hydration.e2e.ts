import { expect, test, type Page } from "@playwright/test";
// Not a React hook despite its name; the alias keeps react-hooks/rules-of-hooks quiet inside a helper.
import { useFakeChain as routeFakeChain } from "./fake-chain";

/**
 * Text typed into a server-rendered form before the page's script has loaded must survive hydration
 * (ekido-ai/ekido-core#125). Each test slows every script by 1.5 s, like a slow phone connection, types as soon as
 * the field is in the HTML, then waits for the page to hydrate. Nothing is sent: the sign-in request is answered
 * here, in the browser.
 */

const REMOTE = Boolean(process.env.E2E_BASE_URL);

async function slowScripts(page: Page) {
  await page.addInitScript(() => localStorage.setItem("ekido.notice", "1"));
  if (!REMOTE) await routeFakeChain(page);
  await page.route(/\/_next\/static\/.*\.js(\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
}

async function hydrated(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);
}

test("/login: an email typed before the script loads is sent", async ({ page }) => {
  await slowScripts(page);
  let sent: string | null = null;
  await page.route("**/v1/auth/email/start", (route) => {
    sent = route.request().postData();
    return route.fulfill({ status: 202, contentType: "application/json", body: "{}" });
  });
  await page.goto("/login", { waitUntil: "commit" });
  const email = page.getByLabel(/email/i).first();
  await email.fill("qa-early@example.com");
  await hydrated(page);
  await expect(email).toHaveValue("qa-early@example.com");
  await page.getByRole("button", { name: /Email me/ }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  expect(sent, "the sign-in request carries the typed email").toContain("qa-early@example.com");
});

test("/verify: a hash and wallet typed before the script loads stay in the fields", async ({ page }) => {
  await slowScripts(page);
  await page.goto("/verify", { waitUntil: "commit" });
  await page.getByLabel("Transaction hash").fill("0xabc");
  await page.getByLabel("Recipient wallet").fill("0xdef");
  await hydrated(page);
  await expect(page.getByLabel("Transaction hash")).toHaveValue("0xabc");
  await expect(page.getByLabel("Recipient wallet")).toHaveValue("0xdef");
});

test("/jobs/new: JSON pasted before the script loads enables Verify signed terms", async ({ page }) => {
  // The signed-job form only renders on a Base Sepolia deployment (https coordinator, escrow, NEXT_PUBLIC_SIGNED_JOBS),
  // which the local test build is not.
  test.skip(!REMOTE, "needs a deployment with signed jobs on, e.g. E2E_BASE_URL=https://ekido-staging.duckdns.org");
  await slowScripts(page);
  await page.goto("/jobs/new", { waitUntil: "commit" });
  await page.getByLabel("Signed job request JSON").fill('{"a": 1}');
  await hydrated(page);
  await expect(page.getByLabel("Signed job request JSON")).toHaveValue('{"a": 1}');
  await expect(page.getByRole("button", { name: "Verify signed terms" })).toBeEnabled();
});
