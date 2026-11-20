import { expect, test } from "@playwright/test";

const csv = 'message,label\n"Mera naam Rahul Sharma hai, call 9876543210",complaint\nORD123456 aaya nahi,order\n';

test("the prepare screen removes personal details in the browser, sends nothing, and gives back an encrypted file only the key opens", async ({ page }) => {
  const outgoing: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") console.log("BROWSER", m.text()); });
  page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
  page.on("request", (r) => { if (r.method() !== "GET") outgoing.push(`${r.method()} ${r.url()} ${r.postData() ?? ""}`); });

  await page.goto("/prepare");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "tickets.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByRole("status").filter({ hasText: "2 rows in tickets.csv" })).toBeVisible();
  await expect(page.getByText("1 names")).toBeVisible();
  await expect(page.getByText("1 phone numbers")).toBeVisible();
  await expect(page.getByRole("cell", { name: "9876543210" })).toBeVisible(); // shown to the customer only, in the preview

  const encrypt = page.getByRole("button", { name: "Encrypt the cleaned file" });
  await expect(encrypt).toBeDisabled(); // the preview must be confirmed first
  await page.getByLabel(/I have looked at what was removed/).check();
  await encrypt.click();

  const [fileDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download encrypted file" }).click()]);
  const [keyDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download your key" }).click()]);
  const sealedPath = await fileDownload.path();
  const keyPath = await keyDownload.path();
  const fs = await import("node:fs");
  const sealed = fs.readFileSync(sealedPath!);
  const identity = fs.readFileSync(keyPath!, "utf8").trim();
  expect(identity).toMatch(/^AGE-SECRET-KEY-/);
  expect(sealed.toString("latin1")).not.toContain("complaint");
  expect(sealed.toString("latin1")).not.toContain("Rahul");

  // Open it again with the key, in the same page.
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "dataset.jsonl.age", mimeType: "application/octet-stream", buffer: sealed });
  await page.locator('input[type="password"]').fill(identity);
  const [opened] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Decrypt and download" }).click()]);
  const text = fs.readFileSync((await opened.path())!, "utf8");
  expect(text).toContain("[NAME]");
  expect(text).toContain("[PHONE]");
  expect(text).not.toMatch(/Rahul|9876543210/);

  // Nothing at all was sent anywhere with a body: the raw file never left the page.
  expect(outgoing.filter((o) => /Rahul|9876543210|AGE-SECRET-KEY/.test(o))).toEqual([]);
});

test("a wrong key does not open the file and says so", async ({ page }) => {
  await page.goto("/prepare");
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "x.age", mimeType: "application/octet-stream", buffer: Buffer.from("not age") });
  await expect(page.getByText("not an encrypted file made by this page")).toBeVisible();
});
