/**
 * Runtime config from NEXT_PUBLIC_* env vars (baked in at build time).
 * Defaults point at a coordinator on this machine, never at a remote service.
 */
/**
 * Next.js inlines NEXT_PUBLIC_* into the browser bundle only for literal
 * `process.env.NEXT_PUBLIC_X` references, so every variable is listed here by name.
 * A dynamic `process.env[name]` would be undefined in the browser.
 */
const raw: Record<string, string | undefined> = {
  NEXT_PUBLIC_COORDINATOR_URL: process.env.NEXT_PUBLIC_COORDINATOR_URL,
  NEXT_PUBLIC_COORDINATOR_WS: process.env.NEXT_PUBLIC_COORDINATOR_WS,
  NEXT_PUBLIC_EVENT_SOURCE: process.env.NEXT_PUBLIC_EVENT_SOURCE,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  NEXT_PUBLIC_ESCROW_ADDRESS: process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
  NEXT_PUBLIC_FALLBACK: process.env.NEXT_PUBLIC_FALLBACK,
  NEXT_PUBLIC_DISPUTE_WINDOW_S: process.env.NEXT_PUBLIC_DISPUTE_WINDOW_S,
  NEXT_PUBLIC_DEMO_HELPER_URL: process.env.NEXT_PUBLIC_DEMO_HELPER_URL,
  NEXT_PUBLIC_HOSTED_DEMO: process.env.NEXT_PUBLIC_HOSTED_DEMO,
  NEXT_PUBLIC_SIGNED_JOBS: process.env.NEXT_PUBLIC_SIGNED_JOBS,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
};
const env = (k: keyof typeof raw & string) => {
  const v = raw[k];
  return v && v.trim() ? v.trim() : null;
};

const chainId = Number(env("NEXT_PUBLIC_CHAIN_ID") ?? 84532);

export const config = {
  /** Coordinator REST base, e.g. http://localhost:8000 */
  coordinatorUrl: env("NEXT_PUBLIC_COORDINATOR_URL") ?? "http://127.0.0.1:8000",
  /** experiments/demo_stack.py's local helper, behind the Start demo job button. */
  demoHelperUrl: env("NEXT_PUBLIC_DEMO_HELPER_URL") ?? "http://127.0.0.1:8001",
  hostedDemo: env("NEXT_PUBLIC_HOSTED_DEMO") === "1",
  signedJobs: env("NEXT_PUBLIC_SIGNED_JOBS") === "1",
  /** Shown on the privacy, terms and security pages. Unset hides the address rather than inventing one. */
  contactEmail: env("NEXT_PUBLIC_CONTACT_EMAIL"),
  /** Job event stream. `{job}` is replaced with the job id, or "current". */
  coordinatorWs: env("NEXT_PUBLIC_COORDINATOR_WS") ?? "ws://localhost:8787/ws/jobs/{job}",
  defaultSource: env("NEXT_PUBLIC_EVENT_SOURCE") === "replay" ? ("replay" as const) : ("live" as const),

  chainId,
  /** 31337 = local Anvil. Anything else is treated as Base Sepolia. */
  localChain: chainId === 31337,
  rpcUrl: env("NEXT_PUBLIC_RPC_URL") ?? (chainId === 31337 ? "http://127.0.0.1:8545" : "https://sepolia.base.org"),
  explorer: chainId === 31337 ? null : "https://sepolia.basescan.org",
  /** Circle test USDC on Base Sepolia (plan.md section D). Override with MockUSDC on Anvil. */
  usdcAddress: (env("NEXT_PUBLIC_USDC_ADDRESS") ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`,
  /** Set once Arvind deploys GPUChainEscrow. Null disables the funding step. */
  escrowAddress: env("NEXT_PUBLIC_ESCROW_ADDRESS") as `0x${string}` | null,
  /**
   * Fallback L3 (plan.md section J): set NEXT_PUBLIC_FALLBACK=synthetic when the GPU is down and
   * the CPU synthetic workload runs instead. The events don't say this, so the operator does.
   */
  fallbackSynthetic: env("NEXT_PUBLIC_FALLBACK") === "synthetic",
  /** Short windows are for local demos only; public jobs default to one hour. */
  disputeWindowS: Number(env("NEXT_PUBLIC_DISPUTE_WINDOW_S") ?? (chainId === 31337 ? 120 : 3600)),
};

export function wsUrlFor(jobId: string | null): string {
  return config.coordinatorWs.replace("{job}", encodeURIComponent(jobId ?? "current"));
}
