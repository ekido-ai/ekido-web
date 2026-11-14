/**
 * Keeps the coordinator operator token for the life of this browser tab only (sessionStorage), so it is pasted once
 * per visit instead of once per job. It is never written to localStorage, and it goes away when the tab closes.
 */
const KEY = "gpuchain.operatorToken";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null; // storage can be blocked
  }
}

export function loadToken(store: Store | null = defaultStore()): string {
  try {
    return store?.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string, store: Store | null = defaultStore()): void {
  try {
    if (token) store?.setItem(KEY, token);
  } catch {
    // the page works without it
  }
}

export function clearToken(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
