import { config } from "@/lib/config";
import { PlatformError } from "@/lib/platform/api";

/*
 * The owner's admin API (ekido-platform /v1/admin, ticket C26). Only an email listed in ADMIN_EMAILS gets in; anyone
 * else gets 404, so `NOT_FOUND` from these calls means "not an admin" as much as "no such thing". Jobs, providers and
 * settlements come from the Coordinator through the Platform, so the operator token never reaches the browser.
 */

export type AdminTeam = { org_id: string; name: string; members: number; active_keys: number; created_at: string | null };
export type AdminJob = { job_id: string; state: string; budget_usdc?: string; total_steps?: number | null; created_at?: string; attempt?: number };
export type AdminJobDetail = {
  job: AdminJob & { spec_hash?: string; policy_hash?: string; deadline?: string; onchain_id?: string | number | null };
  checkpoints: { checkpoint_id: string; logical_step: number; state: string; size_bytes: number | null; signer: string | null }[];
};
export type AdminProvider = {
  provider_id: string;
  name: string;
  wallet_address: string;
  kind?: string;
  status: string;
  gpu_model?: string | null;
  gpu_vram_mib?: number | null;
  price_per_step?: string;
};
export type AdminSettlement = { job_id: string; status: string; created_at: string | null; verdict: string | null; submit_tx: string | null; finalize_tx: string | null };
export type AdminOrder = { order_id: string; org_id: string; team: string | null; amount_paise: number; currency: string; status: string; job_id: string | null; created_at: string | null };
export type AdminAction = { id: string; at: string; email: string; action: string; target: string; outcome: string; detail: Record<string, unknown> };

const base = () => `${config.coordinatorUrl.replace(/\/$/, "")}/v1/admin`;

async function call<T>(method: "GET" | "POST", path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base() + path, { method, credentials: "include", signal: AbortSignal.timeout(20000) });
  } catch {
    throw new PlatformError(0, "OFFLINE", "Couldn't reach Ekido. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof data?.error === "string" ? data.error : `HTTP_${response.status}`;
    const detail = typeof data?.detail === "string" ? data.detail : "Something went wrong. Try again.";
    throw new PlatformError(response.status, code, detail);
  }
  return data as T;
}

const id = encodeURIComponent;

export const admin = {
  teams: () => call<AdminTeam[]>("GET", "/orgs"),
  jobs: () => call<AdminJob[]>("GET", "/jobs"),
  job: (jobId: string) => call<AdminJobDetail>("GET", `/jobs/${id(jobId)}`),
  cancelJob: (jobId: string) => call<AdminJob>("POST", `/jobs/${id(jobId)}/cancel`),
  providers: () => call<AdminProvider[]>("GET", "/providers"),
  settlements: () => call<AdminSettlement[]>("GET", "/payments"),
  orders: () => call<AdminOrder[]>("GET", "/orders"),
  refund: (orderId: string) => call<{ order_id: string; status: string; amount_paise: number }>("POST", `/orders/${id(orderId)}/refund`),
  audit: () => call<AdminAction[]>("GET", "/audit"),
};

/** Whole paise as rupees, e.g. 125000 → "₹1,250.00". */
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
