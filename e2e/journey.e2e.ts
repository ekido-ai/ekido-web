import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Customer journey J1 on staging (ticket P5, ekido-ai/ekido-internal#46):
 * sign up → API key → recipe → upload a CSV (PII preview; the raw CSV is never sent) → quote → pay with Razorpay's
 * test UPI → progress → result → call the endpoint → the forced-fail refund.
 *
 * Steps that staging can run today are real tests. The others are test.fixme with the blocker named, so each one is
 * switched on by deleting a single line once its blocker lands (see the status table on #46).
 *
 * Runs against a deployed site only:
 *   E2E_BASE_URL=https://ekido-staging.duckdns.org JOURNEY_SESSION=… npx playwright test e2e/journey.e2e.ts --project=desktop
 * JOURNEY_SESSION is the `ekido_session` cookie of a test account that owns a team (sessions last 30 days). It's a
 * stand-in until the nightly run can sign in by itself; keep it in a CI secret, never in the repo or a log.
 */

const BASE = (process.env.E2E_BASE_URL ?? "").replace(/\/$/, "");
const API = `${BASE}/sepolia/v1`;
const SESSION = process.env.JOURNEY_SESSION;
const RECIPE = "ticket-sorter-hinglish";
const LABELS = ["complaint", "order", "question", "refund", "other"];

test.describe.configure({ mode: "serial" });
test.skip(!BASE, "Journey tests run against a deployed site: set E2E_BASE_URL.");
test.skip(!SESSION, "Set JOURNEY_SESSION to a test account's session cookie (see the comment at the top).");

let api: APIRequestContext;
let orgId: string;
let keyId: string | null = null;
let keySecret: string | null = null;
let datasetId: string;

test.beforeAll(async ({ playwright }, testInfo) => {
  // One browser is enough for an API-led journey; the bug bash (P6) covers other browsers and sizes.
  testInfo.skip(testInfo.project.name !== "desktop", "Runs once, on the desktop project.");
  api = await playwright.request.newContext({
    extraHTTPHeaders: { cookie: `ekido_session=${SESSION}`, "content-type": "application/json" },
  });
});

test.afterAll(async () => {
  if (!api) return;
  // Never leave a working key behind on staging, even when a step failed.
  if (keyId) await api.delete(`${API}/orgs/${orgId}/api-keys/${keyId}`).catch(() => undefined);
  await api.dispose();
});

test("1. signed in, with a team", async () => {
  const res = await api.get(`${API}/me`);
  expect(res.status(), "GET /v1/me with the test session").toBe(200);
  const me = await res.json();
  const team = (me.orgs ?? []).find((o: { role: string }) => ["owner", "admin"].includes(o.role));
  expect(team, "the test account owns or administers a team").toBeTruthy();
  orgId = team.org_id;
});

test("2. create an API key; it works once created and is shown only once", async () => {
  const res = await api.post(`${API}/orgs/${orgId}/api-keys`, { data: { name: `journey ${new Date().toISOString()}`, mode: "test", scopes: ["jobs", "models.read"] } });
  expect(res.status()).toBe(201);
  const key = await res.json();
  keyId = key.key_id;
  keySecret = key.secret;
  expect(keySecret, "a test key").toMatch(/^ek_test_/);

  // The key alone (no cookie) opens the team.
  const asKey = await api.fetch(`${API}/orgs/${orgId}`, { headers: { cookie: "", authorization: `Bearer ${keySecret}` } });
  expect(asKey.status(), "GET /v1/orgs/{org} with the new key").toBe(200);

  // The list never shows the secret again.
  const list = await (await api.get(`${API}/orgs/${orgId}/api-keys`)).text();
  expect(list.includes(keySecret!), "the key list must not contain the secret").toBe(false);
});

test("3. pick a recipe", async () => {
  const res = await api.get(`${API}/recipes`);
  expect(res.status()).toBe(200);
  const recipe = (await res.json()).find((r: { recipe_id: string }) => r.recipe_id === RECIPE);
  expect(recipe, RECIPE).toBeTruthy();
  expect(recipe.labels).toEqual(expect.arrayContaining(LABELS));
});

test("4. upload a CSV with names and phone numbers: the preview shows what was removed, and the raw CSV is never sent", async () => {
  test.fixme(true, "No customer upload flow on staging yet (/train, /upload 404). Waiting on ekido-ai/ekido-web#28.");
  // When #28 is on staging: open the upload page, attach a CSV whose rows contain a made-up name and phone number,
  // record every request the page makes (page.on("request")), and assert:
  //  - the preview lists what was removed (names, phone numbers) before anything is sent;
  //  - no request body contains the raw name or phone number, or the CSV file itself;
  //  - the POST /v1/orgs/{org}/datasets body holds only the cleaned rows, with `redactions` counting what was removed.
});

test("5. quote shows rupees, GST, an estimated time and the quality bar in plain words", async () => {
  // Until the upload UI exists (step 4), the cleaned rows go straight to the API, as the browser will send them.
  const test_ = Array.from({ length: 20 }, (_, i) => ({ text: `journey test ticket ${i + 1}: mera order kab aayega?`, label: LABELS[i % LABELS.length] }));
  const ds = await api.post(`${API}/orgs/${orgId}/datasets`, { data: { recipe_id: RECIPE, train: [{ text: "journey train row: refund chahiye", label: "refund" }], test: test_ } });
  expect(ds.status(), "POST datasets").toBe(201);
  datasetId = (await ds.json()).dataset_id;

  const res = await api.post(`${API}/orgs/${orgId}/quotes`, { data: { dataset_id: datasetId } });
  expect(res.status(), "POST quotes").toBe(201);
  const q = await res.json();
  expect(q.currency).toBe("INR");
  expect(q.total_paise).toBeGreaterThan(0);
  expect(q.gst_paise, "GST is shown").toBeGreaterThan(0);
  expect(q.total_paise).toBe(q.training_paise + q.gst_paise);
  expect(q.eta_minutes, "estimated time").toBeGreaterThan(0);
  expect(q.quality_terms?.plain_words, "the quality bar in plain words").toMatch(/\d+%/);
  expect(q.refund_policy, "refund policy").toMatch(/refund/i);
  expect(new Date(q.expires_at).getTime()).toBeGreaterThan(Date.now());
});

test("6. pay with Razorpay's test UPI; the job starts", async () => {
  test.fixme(true, "Payments aren't configured on staging: POST /v1/quotes/{id}/orders answers 503 PAYMENTS_UNAVAILABLE.");
  // When Razorpay test keys are on staging: create the order, pay in Razorpay's test checkout with the test UPI id
  // (success@razorpay), and wait for the job to start.
});

test("7. progress updates without a refresh and never names a provider", async () => {
  test.fixme(true, "Needs a paid order (step 6).");
});

test("8. result: the endpoint answers with the API key, the download works and the savings report opens", async () => {
  test.fixme(true, "Needs a finished job (steps 6 and 7). Note: savings reports answer 503 SAVINGS_UNAVAILABLE on staging today.");
});

test("9. a forced quality failure shows the refund", async () => {
  test.fixme(true, "Needs a paid order (step 6) and a way to force a quality failure on staging.");
});
