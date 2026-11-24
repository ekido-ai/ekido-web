import { expect, test } from "@playwright/test";
import { useFakeChain } from "./fake-chain";

/**
 * Regression tests for the header from the P8 rebrand review (ekido-ai/ekido-internal#60):
 * - ekido-ai/ekido-core#119: the wallet button and the email link must not both say "Sign in".
 * - #120: below lg, the marketing header needs a Menu with Products, Solutions, Developers, Pricing and Roadmap.
 * - #121: on phones, the app header's nav labels must not be cut short.
 * Against staging (E2E_BASE_URL) they show whether the fixes are deployed.
 */

const REMOTE = Boolean(process.env.E2E_BASE_URL);
const isPhone = () => test.info().project.name === "phone";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ekido.notice", "1"));
  if (!REMOTE) await useFakeChain(page);
});

for (const path of ["/", "/status"]) {
  test(`only one header control is called "Sign in" on ${path}`, async ({ page }) => {
    await page.goto(path);
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: /^(Connect wallet|Wallet)$/ })).toBeVisible();
    // Every visible header control whose whole text is "Sign in": the email link may be one, the wallet must not.
    const named = header.locator("a:visible, button:visible").filter({ hasText: /^\s*Sign in\s*$/ });
    expect(await named.count()).toBeLessThanOrEqual(1);
  });
}

test("below lg, the Menu reaches every marketing section, and closes on Escape and on a choice", async ({ page }) => {
  if (!isPhone()) await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  const menuButton = page.locator("header").getByRole("button", { name: "Menu" });
  const open = () => (isPhone() ? menuButton.tap() : menuButton.click());

  await open();
  const panel = page.locator("#menu-site");
  await expect(panel).toBeVisible();
  // "Developers" is also a Solutions → By role entry, so these are found by address.
  for (const href of ["/developers", "/pricing", "/roadmap", "/login"]) await expect(panel.locator(`a[href="${href}"]`).last()).toBeVisible();
  await expect(panel.getByRole("link", { name: "Sign in with email" })).toBeVisible();
  // Every product, and the Solutions entries under By industry and By role.
  expect(await panel.locator('a[href^="/products/"]').count()).toBeGreaterThanOrEqual(4);
  await expect(panel.getByText("By industry")).toBeVisible();
  await expect(panel.getByText("By role")).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await open();
  const pricing = panel.getByRole("link", { name: "Pricing", exact: true });
  await (isPhone() ? pricing.tap() : pricing.click());
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(panel).toBeHidden();
});

test("the Menu isn't shown from lg up, where the menus are in the header", async ({ page }) => {
  test.skip(isPhone(), "desktop width only");
  await page.goto("/");
  await expect(page.locator("header").getByRole("button", { name: "Products" })).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "Menu" })).toBeHidden();
});

for (const width of [360, 375, 412]) {
  test(`app header nav labels aren't cut short at ${width} px`, async ({ page }) => {
    test.skip(!isPhone(), "phone widths only");
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/status");
    const nav = page.locator("header nav").first();
    for (const label of ["Developers", "Earn", "Pricing", "How it works"]) await expect(nav).toContainText(label);
    const cut = await nav.locator("span.truncate").evaluateAll((spans) =>
      spans.filter((s) => s.scrollWidth > s.clientWidth + 0.5).map((s) => s.textContent),
    );
    expect(cut).toEqual([]);
  });
}
