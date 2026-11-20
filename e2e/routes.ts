import { PRODUCT_META } from "../src/lib/landing/products";

/** Every route under src/app/, shared by the smoke (P1) and provider-privacy (P2) tests. Add new pages here. */
export const ROUTES: string[] = [
  "/",
  "/acceptable-use",
  "/account",
  "/admin",
  "/chain",
  "/dashboard",
  "/developers",
  "/earnings",
  "/help",
  "/jobs/new",
  "/kit",
  "/login",
  "/login/verify",
  "/pricing",
  "/privacy",
  ...PRODUCT_META.map((p) => `/products/${p.key}`),
  "/provide",
  "/quality",
  "/recovery",
  "/replay",
  "/roadmap",
  "/security",
  "/settings",
  "/settlement",
  "/solutions",
  "/status",
  "/terms",
  "/trust",
  "/verify",
];

/** True when testing a running site (E2E_BASE_URL, e.g. staging) rather than the local build against the mock. */
export const REMOTE = Boolean(process.env.E2E_BASE_URL);
