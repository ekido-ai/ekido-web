import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests in e2e/. By default they build and start the app on port 3100 against the mock coordinator
 * (replay/mock-coordinator.mts on 8787). Set E2E_BASE_URL to test a running site instead, for example staging:
 *   E2E_BASE_URL=https://ekido-staging.duckdns.org npm run e2e
 * Locally, set E2E_BROWSER_CHANNEL=msedge (or chrome) to use an installed browser instead of downloading one.
 */
const remote = process.env.E2E_BASE_URL;
const channel = process.env.E2E_BROWSER_CHANNEL;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts", // Not *.spec.ts: vitest would pick those up too.
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: remote ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) } },
    { name: "phone", use: { ...devices["Pixel 7"], ...(channel ? { channel } : {}) } },
  ],
  webServer: remote
    ? undefined
    : [
        { command: "npm run mock -- --port=8787", url: "http://127.0.0.1:8787/health", reuseExistingServer: !process.env.CI, timeout: 60_000 },
        {
          command: "npx next build && npx next start -p 3100 -H 127.0.0.1",
          url: "http://127.0.0.1:3100",
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
          env: { NEXT_PUBLIC_COORDINATOR_URL: "http://127.0.0.1:8787", NEXT_PUBLIC_EVENT_SOURCE: "replay" },
        },
      ],
});
