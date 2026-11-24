"use client";

import { useEffect, useState } from "react";
import { hasAccountHint } from "./account-hint";
import { platform, type Me } from "./api";
import { config } from "../config";

/*
 * "Is an Ekido account signed in here?" for calls that only an account may make (ekido-ai/ekido-internal#93).
 * Without the account note it answers no straight away, so a signed-out visitor sends nothing that would be refused.
 * With the note it asks `/v1/me` once and shares the answer; a 401 there removes the note (api.ts).
 */

let asking: Promise<boolean> | null = null;
let known = false;

export function accountSignedIn(): Promise<boolean> {
  if (!hasAccountHint()) {
    known = false;
    return Promise.resolve(false);
  }
  if (known) return Promise.resolve(true);
  asking ??= platform
    .me()
    .then(
      () => (known = true),
      () => false,
    )
    .finally(() => {
      asking = null;
    });
  return asking;
}

/**
 * The signed-in account, or null. Without the account note it is null straight away, with no request, so the
 * header doesn't log a `/v1/me` 401 on every page for a signed-out visitor (ekido-ai/ekido-internal#93).
 */
export function currentAccount(): Promise<Me | null> {
  if (!hasAccountHint()) return Promise.resolve(null);
  return platform.me().then(
    (me) => {
      known = true;
      return me;
    },
    () => null,
  );
}

/**
 * True when the coordinator is served from the site's own host (Caddy's `/sepolia`), which is how the public
 * deployments run. There its provider list, settlements and log index are private: they answer only the operator
 * token, not a signed-in account (checked on staging, 24 Nov, Chromium, WebKit and Firefox: 401 with a valid
 * session). A coordinator on another origin is a local demo or test, where they are open to the page.
 */
export function coordinatorOnSite(coordinatorUrl: string, siteHref: string): boolean {
  try {
    return new URL(coordinatorUrl, siteHref).origin === new URL(siteHref).origin;
  } catch {
    return false;
  }
}

/** Whether the page may ask for the coordinator's private lists without being refused: only off the public site. */
export function privateListsReadable(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return Promise.resolve(!coordinatorOnSite(config.coordinatorUrl, window.location.href));
}

/** privateListsReadable() as state; null until known. */
export function usePrivateListsReadable(): boolean | null {
  const [readable, setReadable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void privateListsReadable().then((v) => alive && setReadable(v));
    return () => {
      alive = false;
    };
  }, []);
  return readable;
}
