import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Text comes from messages/<locale>.json through next-intl (src/i18n/request.ts).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/*
 * Where the browser may connect. If a script were ever injected, it still couldn't send data anywhere else.
 * Built from the same public settings the app uses, plus the chain RPCs it reads.
 */
function origin(url: string | undefined): string[] {
  if (!url) return [];
  try {
    const u = new URL(url.replace("{job}", "x"));
    return [`${u.protocol}//${u.host}`];
  } catch {
    return [];
  }
}
const connect = [
  "'self'",
  ...origin(process.env.NEXT_PUBLIC_COORDINATOR_URL),
  ...origin(process.env.NEXT_PUBLIC_COORDINATOR_WS),
  ...origin(process.env.NEXT_PUBLIC_RPC_URL),
  ...origin(process.env.NEXT_PUBLIC_DEMO_HELPER_URL),
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
  // Local development and the laptop demo stack.
  "http://127.0.0.1:8000", "ws://127.0.0.1:8000", "http://127.0.0.1:8001", "http://127.0.0.1:8545",
  "ws://localhost:8787", "http://localhost:8000", "ws://localhost:8000",
];
const CSP = [
  "default-src 'self'",
  // Next.js inlines its bootstrap and our theme script; no third-party scripts are allowed.
  // 'wasm-unsafe-eval' lets the browser compile our own WebAssembly (the personal-detail remover, ticket C16) and nothing else:
  // it does not allow eval() or new Function(), which 'unsafe-eval' would.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${[...new Set(connect)].join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    // Nobody can frame these pages (clickjacking on wallet steps), sniff types or read the full referrer.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: process.env.NODE_ENV === "production" ? CSP : "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
  async redirects() {
    // The landing page is "/" and the dashboard "/dashboard". Old links keep working:
    // "/?view=dashboard", "/?at=…" and the rest move to /dashboard with their query intact.
    const old = ["view", "at", "play", "source", "job"].map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key }],
      destination: "/dashboard",
      permanent: false,
    }));
    return [
      ...old,
      { source: "/nexora", destination: "/", permanent: false },
      { source: "/welcome", destination: "/", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
