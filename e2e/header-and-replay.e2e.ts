import { expect, test, type Page } from "@playwright/test";
import { useFakeChain } from "./fake-chain";

/**
 * Regression tests for the header menus, the wallet menu and the replay scrubber, from the P6 bug bash
 * (ekido-ai/ekido-internal#47):
 * - ekido-ai/ekido-core#123: hover then click must leave a menu open.
 * - #124 and #129: on phones, the wallet and "How it works" menus must fit on screen.
 * - #126: /replay must hydrate without a React error.
 * - #128: the scrubber must be at least 24 px tall and must take Home and End.
 * - #130: the Mission control headline must not be squeezed on phones in Recorded mode.
 * Against staging (E2E_BASE_URL) they show whether the fixes are deployed.
 */

const REMOTE = Boolean(process.env.E2E_BASE_URL);
const isPhone = () => test.info().project.name === "phone";

test.beforeEach(async ({ page }) => {
  // The storage notice sits over the bottom of the screen on phones until dismissed; these tests aren't about it.
  await page.addInitScript(() => localStorage.setItem("ekido.notice", "1"));
  if (!REMOTE) await useFakeChain(page);
});

async function onScreen(page: Page, box: { x: number; width: number } | null) {
  const width = page.viewportSize()!.width;
  expect(box, "the menu is visible").not.toBeNull();
  expect(box!.x, "left edge on screen").toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, "right edge on screen").toBeLessThanOrEqual(width);
}

test("marketing header: hover then click keeps Products open; a second click closes it", async ({ page }) => {
  test.skip(isPhone(), "the marketing menus are desktop-only (lg and up)");
  await page.goto("/");
  const products = page.getByRole("navigation", { name: "Product" }).getByRole("button", { name: "Products" });
  await products.hover();
  await expect(page.locator("#menu-products")).toBeVisible();
  await products.click();
  await expect(page.locator("#menu-products"), "still open after the click").toBeVisible();
  await page.mouse.move(5, 700);
  await page.waitForTimeout(400); // longer than the 180 ms close delay
  await expect(page.locator("#menu-products"), "a clicked menu stays open when the pointer leaves").toBeVisible();
  await products.click();
  await expect(page.locator("#menu-products")).toBeHidden();
});

test("app header: hover then click keeps How it works open, and choosing an item closes it", async ({ page }) => {
  test.skip(isPhone(), "phones tap; covered by the on-screen test below");
  await page.goto("/dashboard");
  const group = page.locator("header").getByRole("button", { name: /How it works/ });
  await group.hover();
  await group.click();
  const menu = page.locator("header").getByRole("menu");
  await expect(menu, "still open after the click").toBeVisible();
  await menu.locator('a[href="/settlement"]').click();
  await expect(page).toHaveURL(/\/settlement$/);
  await expect(menu).toBeHidden();
});

for (const path of ["/", "/dashboard"]) {
  test(`wallet Sign in menu fits on screen on ${path}`, async ({ page }) => {
    if (isPhone()) await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(path);
    await page.locator("header").getByRole("button", { name: /^Sign in$/ }).click();
    await onScreen(page, await page.getByRole("menu").first().boundingBox());
  });
}

test("How it works menu fits on screen", async ({ page }) => {
  if (isPhone()) await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/dashboard");
  const group = page.locator("header").getByRole("button", { name: /How it/ });
  if (isPhone()) await group.tap();
  else await group.click();
  const menu = page.locator("header").getByRole("menu");
  await expect(menu).toBeVisible();
  await onScreen(page, await menu.boundingBox());
  for (const label of await menu.getByRole("menuitem").all()) await expect(label).toBeInViewport({ ratio: 1 });
});

for (const source of ["live", "replay"]) {
  test(`/replay hydrates without a React error (${source})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
    // ?source=live starts the live stream straight after the layout hydrates, before the page does: the case
    // that used to hydrate the page against the live state instead of the server's.
    await page.goto(`/replay?source=${source}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => /#418|#423|#425|hydrat/i.test(e))).toEqual([]);
  });
}

test("replay scrubber: 24 px tall, Home and End go to the ends", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ekido.source", "replay"));
  await page.goto("/replay");
  const bar = page.getByRole("slider", { name: "Replay position" });
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.height, "touch target height").toBeGreaterThanOrEqual(24);
  const max = await bar.getAttribute("aria-valuemax");
  await bar.focus();
  await page.keyboard.press("End");
  await expect(bar).toHaveAttribute("aria-valuenow", max!);
  await page.keyboard.press("Home");
  await expect(bar).toHaveAttribute("aria-valuenow", "0");
});

test("Mission control's headline isn't squeezed in Recorded mode (ekido-ai/ekido-core#130)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ekido.source", "replay"));
  await page.goto("/dashboard");
  const headline = page.getByText("No job yet", { exact: true }).first();
  await expect(headline).toBeVisible();
  const box = (await headline.boundingBox())!;
  // One line of 20 px text is about 28 px tall; the bug made it three lines and 28 px wide.
  expect(box.height, "the headline fits on one line").toBeLessThan(40);
  const hint = page.getByText(/Recording: Kill only works live/);
  const h = (await hint.boundingBox())!;
  const overlaps = box.x < h.x + h.width && h.x < box.x + box.width && box.y < h.y + h.height && h.y < box.y + box.height;
  expect(overlaps, "the headline and the hint don't overlap").toBe(false);
});
