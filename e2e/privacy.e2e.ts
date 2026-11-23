import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadIdentities, type Identities } from "./privacy/identities";
import { assertRedacted, tag } from "./privacy/redact";
import { pageFindings, scanJson } from "./privacy/scan";
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
 *
 * This repo is public, so a failing run must not publish what it protects. Findings name the kind of leak, where it
 * is and a one-way tag, never the value (privacy/redact.ts), and assertRedacted() checks that before anything is
 * printed. They are also written to privacy-findings/, the only thing the nightly workflow uploads.
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
    expected: (f) => /^names a provider \(wallet( \(shortened\))?, sha256 [0-9a-f]{6}\)$/.test(f) || f === `provider list: heading (${tag("Providers, as they committed themselves")})`,
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
  report("api", found);
  expect(found, "provider identities in public API answers").toEqual([]);
});

const FINDINGS_DIR = "privacy-findings";

/**
 * Checks the findings hold no identity, then writes them to privacy-findings/<project>/<test>.txt. That folder is
 * what the nightly workflow uploads: never the HTML report, traces or screenshots, which show the page itself.
 */
function report(name: string, found: string[]) {
  assertRedacted(found, ids.exact);
  if (found.length === 0) return;
  const dir = join(FINDINGS_DIR, test.info().project.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.txt`), `${found.join("\n")}\n`);
}

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
      // Signed out on a public server, /chain reads the chain only when asked (ekido-ai/ekido-internal#93).
      const check = page.getByRole("button", { name: "Check on chain" });
      await expect(page.getByText(LOADED[path]).first().or(check)).toBeVisible({ timeout: 90_000 });
      if (await check.isVisible()) await check.click();
      await expect(page.getByText(LOADED[path]).first(), `${path} finished loading, so the whole page is checked`).toBeVisible({ timeout: 90_000 });
    } else {
      // Some pages poll, so the network may never go quiet: wait for it a while, then check what's there.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(2_000);
    const { text, html, headings } = await readPage(page);

    const found = [...pageFindings({ text, html, headings }, ids), ...(await Promise.all(answers)).flat()];
    report(path, found);

    const known = KNOWN_LEAKS[path];
    if (known) {
      // Checked before test.fail(), so these are real failures: a page that didn't load, or a leak the issue doesn't cover.
      expect(found.filter((f) => !known.expected(f)), `${path}: leaks beyond ${known.issue}`).toEqual([]);
      test.fail(true, `known leak ${known.issue}`);
    }
    expect(found, `${path} as a visitor`).toEqual([]);
  });
}
