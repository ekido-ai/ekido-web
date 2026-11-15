import { expect, test } from "@playwright/test";

/**
 * The pattern for page smoke tests (ticket P1): copy this file per route under src/app/, keeping the .e2e.ts ending (vitest ignores it).
 * Each test checks the page loads, has no console errors, shows its main heading and doesn't scroll sideways
 * on a phone-sized screen.
 */
test("home page loads cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "the page scrolls sideways").toBeLessThanOrEqual(0);
  expect(errors, "console errors").toEqual([]);
});
