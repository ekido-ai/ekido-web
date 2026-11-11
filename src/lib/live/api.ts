import { config } from "../config";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; error: string };

/**
 * POST to the coordinator. Every mutating call carries an Idempotency-Key
 * (plan.md section E), so a retried click can never double-apply.
 */
export async function post<T>(
  path: string,
  body: unknown,
  idempotencyKey: string = crypto.randomUUID(),
  options?: { token: string; timeoutMs?: number },
): Promise<ApiResult<T>> {
  const url = `${config.coordinatorUrl}${path}`;
  try {
    if (options?.token && new URL(url).protocol !== "https:") {
      return { ok: false, status: null, error: "The operator token requires an HTTPS coordinator." };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(body),
      redirect: options?.token ? "error" : "follow",
      signal: AbortSignal.timeout(options?.timeoutMs ?? 8000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : data && typeof data === "object" && "error" in data ? String(data.error) : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: `${msg} (POST ${path})` };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    return {
      ok: false,
      status: null,
      error: timeout
        ? "The coordinator is still processing or could not answer. Retry the same request."
        : `Couldn't reach the coordinator at ${config.coordinatorUrl}. Is it running?`,
    };
  }
}
