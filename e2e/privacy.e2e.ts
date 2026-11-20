import { expect, test, type Page } from "@playwright/test";
import { loadIdentities, identitiesIn, type Identities } from "./privacy/identities";
import { PROVIDER_LIST_HEADING, countsIn, gpuModelsIn, scanJson } from "./privacy/scan";
import { REMOTE, ROUTES } from "./routes";

/**
 * Provider privacy (ticket P2, decision 8): a visitor without the operator token must not learn who the providers
 * are or how many there are. Loads every page and every public API answer on staging and fails on any provider
 * name, wallet, GPU model, list of providers or count of providers.
 *
 * Runs against a deployed site only (staging, nightly: .github/workflows/privacy-nightly.yml):
 *   E2E_BASE_URL=https://ekido-staging.duckdns.org npx playwright test e2e/privacy.e2e.ts
 * Set EKIDO_OPERATOR_TOKEN to also check for provider names, ids, keys and their own GPU models.
 * E2E_COORDINATOR_URL defaults to <site>/sepolia, where staging serves the coordinator.
 */

/**
 * Pages that fill in from the chain after loading, and the text that says they finished. The test waits for it, so
 * it checks the whole page rather than a loading spinner; a page that never finishes fails instead of passing empty.
 */
const LOADED: Record<string, RegExp> = {
  "/chain": /^\d+ of \d+ agree$|^Mismatch found$/,
};

/**
 * Routes that leak because of a filed bug. `expected` says which findings that bug explains. Anything else on the page
 * still fails the test outright, so a new leak can't hide behind an old one. Once the page has loaded, the test is
 * marked test.fail() with the issue; when the bug is fixed it turns red as "unexpectedly passed": remove the entry.
 */
const KNOWN_LEAKS: Record<string, { issue: string; expected: (finding: string) => boolean }> = {
  // Payees in "Where the money went", "Journal" and "Waiting to be withdrawn", and the registry panel's list.
  "/chain": {
    issue: "ekido-ai/ekido-internal#99",
    expected: (f) => /^names a provider: 0x[0-9a-f]/.test(f) || f === 'provider list: heading "Providers, as they committed themselves"',
  },
};

const COORDINATOR = process.env.E2E_COORDINATOR_URL ?? `${(process.env.E2E_BASE_URL ?? "").replace(/\/$/, "")}/sepolia`;

/** Answer anyone. */
const PUBLIC_PATHS = ["/healthz", "/readyz", "/fees"];
/** Need the operator token on a public server. */
const GUARDED_PATHS = ["/providers", "/settlements?limit=50&offset=0", "/chain/logs?from_block=0&limit=10", "/me/provider"];
/** Job pages are public with every provider identity replaced by a label. */
const JOB_PAGES = ["", "/timeline", "/checkpoints", "/settlement-preview", "/recoveries", "/settlement"];
const JOBS_TO_CHECK = 5;

test.skip(!REMOTE, "Checks a deployed site: set E2E_BASE_URL (see the comment at the top).");

// Loaded once per worker; reading the chain's history takes ~100 log calls.
let ids: Identities;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  ids = await loadIdentities(COORDINATOR);
  console.log(`provider identities from: ${ids.sources.join("; ")}`);
});

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${COORDINATOR}${path}`, { signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: scanned as text.
  }
  return { status: res.status, body };
}

test("public API answers name no provider", async () => {
  const found: string[] = [];
  for (const path of PUBLIC_PATHS) {
    const { status, body } = await getJson(path);
    expect(status, `GET ${path}`).toBe(200);
    found.push(...scanJson(body, ids, `GET ${path}`));
  }
  for (const path of GUARDED_PATHS) {
    const { status, body } = await getJson(path);
    expect([401, 403], `GET ${path} without the operator token`).toContain(status);
    found.push(...scanJson(body, ids, `GET ${path} (refusal)`));
  }

  // The newest public jobs, each page of them.
  const jobs = await getJson("/jobs?limit=40");
  if (jobs.status !== 200) found.push(`GET /jobs answered ${jobs.status}`);
  found.push(...scanJson(jobs.body, ids, "GET /jobs"));
  const jobIds = (Array.isArray(jobs.body) ? jobs.body : []).map((j: { job_id?: string; id?: string }) => j.job_id ?? j.id).filter(Boolean).slice(0, JOBS_TO_CHECK);
  for (const id of jobIds) {
    for (const sub of JOB_PAGES) {
      const path = `/jobs/${id}${sub}`;
      const { status, body } = await getJson(path);
      if (status === 404) continue; // e.g. no settlement yet
      found.push(...scanJson(body, ids, `GET ${path}`));
    }
  }
  test.info().annotations.push({ type: "jobs checked", description: String(jobIds.length) });
  expect(found, "provider identities in public API answers").toEqual([]);
});

/** Everything a page shows or carries: visible text, headings, and the full HTML (attributes, links, inline data). */
async function readPage(page: Page) {
  return page.evaluate(() => ({
    text: document.body.innerText,
    html: document.documentElement.outerHTML,
    headings: [...document.querySelectorAll("h1, h2, h3, h4, [role=heading]")].map((h) => (h as HTMLElement).innerText.trim()),
  }));
}

for (const path of ROUTES) {
  test(`${path} shows no provider identity, list or count`, async ({ page }) => {
    // Reading the chain from a browser can take a while on public RPCs (ekido-ai/ekido-internal#94).
    if (LOADED[path]) test.setTimeout(120_000);

    // Every coordinator answer the page reads as a visitor, scanned like the API above.
    const answers: Promise<string[]>[] = [];
    page.on("response", (res) => {
      if (!res.url().startsWith(COORDINATOR) || res.status() !== 200) return;
      const where = `${path} read ${res.url().slice(COORDINATOR.length)}`;
      answers.push(res.json().then((body) => scanJson(body, ids, where), () => []));
    });

    await page.goto(path);
    if (LOADED[path]) {
      await expect(page.getByText(LOADED[path]).first(), `${path} finished loading, so the whole page is checked`).toBeVisible({ timeout: 90_000 });
    } else {
      // Some pages poll, so the network may never go quiet: wait for it a while, then check what's there.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(2_000);
    const { text, html, headings } = await readPage(page);

    const found = [
      ...identitiesIn(html, ids).map((hit) => `names a provider: ${hit}`),
      ...gpuModelsIn(text, ids).map((model) => `GPU model: ${model}`),
      ...countsIn(text).map((count) => `provider count: "${count}"`),
      ...headings.filter((h) => PROVIDER_LIST_HEADING.test(h)).map((h) => `provider list: heading "${h}"`),
      ...(await Promise.all(answers)).flat(),
    ];

    const known = KNOWN_LEAKS[path];
    if (known) {
      // Checked before test.fail(), so these are real failures: a page that didn't load, or a leak the issue doesn't cover.
      expect(found.filter((f) => !known.expected(f)), `${path}: leaks beyond ${known.issue}`).toEqual([]);
      test.fail(true, `known leak ${known.issue}`);
    }
    expect(found, `${path} as a visitor`).toEqual([]);
  });
}
