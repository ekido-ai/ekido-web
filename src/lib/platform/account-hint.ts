/*
 * Whether this browser has an Ekido account signed in, as far as it knows (ekido-ai/ekido-internal#93).
 *
 * The session cookie is httpOnly, so the page can't see it. Asking `/v1/me` answers 401 to every signed-out
 * visitor, which is the console error #93 is about. So the browser keeps a one-character note, set when `/v1/me` or
 * an email sign-in succeeds and removed on sign-out or when `/v1/me` says nobody is signed in. Without the note, the
 * optional calls that need an account (the coordinator's private lists) are skipped and `/v1/me` isn't asked.
 * Pages that need an account to work at all (/settings, /admin) still ask `/v1/me` every time.
 */

export const ACCOUNT_HINT_KEY = "ekido.account";

export function hasAccountHint(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAccount(): void {
  try {
    localStorage.setItem(ACCOUNT_HINT_KEY, "1");
  } catch {
    /* storage blocked: the private calls are just skipped */
  }
}

export function forgetAccount(): void {
  try {
    localStorage.removeItem(ACCOUNT_HINT_KEY);
  } catch {
    /* nothing stored */
  }
}
