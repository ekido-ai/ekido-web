import { config } from "../config";
import { forgetAccount, rememberAccount } from "./account-hint";

/*
 * The Platform API's account routes (ekido-platform, /v1). The site and the API share a host (Caddy forwards
 * /sepolia/v1 to the Platform), so the httpOnly `ekido_session` cookie is first-party: every call sends it with
 * `credentials: "include"`. The browser never sees the session token itself.
 */

export type Role = "owner" | "admin" | "member";
export type KeyMode = "test" | "live";
export const KEY_SCOPES = ["jobs", "models.read", "models.predict"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];

export type Me = { user_id: string; email: string | null; name: string | null; orgs: { org_id: string; name: string; role: Role }[] };
/** `status` is "invited" until the person signs in from the invite (older Platform versions don't send it). */
export type Member = {
  user_id: string;
  email: string | null;
  role: Role;
  status?: "joined" | "invited";
  invited_at?: string | null;
  joined_at?: string | null;
};
export type Org = { org_id: string; name: string; members: Member[] };
export type ApiKey = { key_id: string; name: string; mode: KeyMode; prefix: string; scopes: KeyScope[]; created_at: string; last_used_at: string | null };
export type NewApiKey = ApiKey & { secret: string };

/**
 * A refused request, with the API's own error code (e.g. SIGN_IN_REQUIRED) and its readable detail. A rate limit
 * (TOO_MANY_LINKS, TOO_MANY_INVITES) also says how many seconds to wait, in `retryAfter`.
 */
export class PlatformError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter: number | null = null,
  ) {
    super(message);
  }
}

const base = () => `${config.coordinatorUrl.replace(/\/$/, "")}/v1`;

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base() + path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new PlatformError(0, "OFFLINE", "Couldn't reach Ekido. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof data?.error === "string" ? data.error : `HTTP_${response.status}`;
    const detail = typeof data?.detail === "string" ? data.detail : "Something went wrong. Try again.";
    const retryAfter = typeof data?.retry_after === "number" && data.retry_after > 0 ? data.retry_after : null;
    throw new PlatformError(response.status, code, detail, retryAfter);
  }
  return data as T;
}

/** Keeps the account note (account-hint.ts) in step with what `/v1/me` and sign-in answer. */
function signedIn(me: Me): Me {
  rememberAccount();
  return me;
}
function signedOutOn401(error: unknown): never {
  if (error instanceof PlatformError && error.status === 401) forgetAccount();
  throw error;
}

export const platform = {
  startEmailSignIn: (email: string) => call<{ sent: boolean }>("POST", "/auth/email/start", { email }),
  verifyEmailSignIn: (token: string) => call<Me>("POST", "/auth/email/verify", { token }).then(signedIn),
  signOut: () => call<void>("POST", "/auth/logout").finally(forgetAccount),
  me: () => call<Me>("GET", "/me").then(signedIn, signedOutOn401),
  createOrg: (name: string) => call<Org>("POST", "/orgs", { name }),
  org: (orgId: string) => call<Org>("GET", `/orgs/${encodeURIComponent(orgId)}`),
  invite: (orgId: string, email: string, role: Role) => call<{ user_id: string; invited: boolean }>("POST", `/orgs/${encodeURIComponent(orgId)}/members`, { email, role }),
  removeMember: (orgId: string, userId: string) => call<void>("DELETE", `/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`),
  keys: (orgId: string) => call<ApiKey[]>("GET", `/orgs/${encodeURIComponent(orgId)}/api-keys`),
  createKey: (orgId: string, name: string, mode: KeyMode, scopes: KeyScope[]) => call<NewApiKey>("POST", `/orgs/${encodeURIComponent(orgId)}/api-keys`, { name, mode, scopes }),
  revokeKey: (orgId: string, keyId: string) => call<void>("DELETE", `/orgs/${encodeURIComponent(orgId)}/api-keys/${encodeURIComponent(keyId)}`),
};

/** A plain email check before asking the API; the Platform validates again. */
export const looksLikeEmail = (value: string) => /^[^@\s]{1,64}@[^@\s]{1,253}\.[^@\s]{2,}$/.test(value.trim());
