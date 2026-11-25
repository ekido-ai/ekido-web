"use client";

import { useEffect, useState } from "react";
import { hasAccountHint } from "./account-hint";
import { platform, type Me } from "./api";
import { config } from "../config";

/*
 * Two questions the pages ask before calling anything private (ekido-ai/ekido-internal#93):
 * - currentAccount(): is an Ekido account signed in here? Only for the Platform's own routes (the header's link).
 * - privateListsReadable(): will the coordinator answer this page for its provider list, settlements and log index?
 * They are separate because the coordinator never reads the Platform session.
 */

/**
 * The signed-in account, or null. Without the account note it is null straight away, with no request, so the
 * header doesn't log a `/v1/me` 401 on every page for a signed-out visitor (ekido-ai/ekido-internal#93).
 */
export function currentAccount(): Promise<Me | null> {
  if (!hasAccountHint()) return Promise.resolve(null);
  return platform.me().catch(() => null);
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether the coordinator at `coordinatorUrl` lets a page at `siteHref` read its private lists (`/providers`,
 * `/settlements`, `/chain/logs`). This follows the coordinator's ApiGuard (ekido-coordinator, api_guard.py), which
 * opens them only to:
 * - the operator token, which a browser never has and must never be given; or
 * - a request made on the coordinator's own machine: a loopback address and Host header, with no X-Forwarded-For.
 *   That is also how a container started with OPEN_API is reached.
 * The guard doesn't read the Platform session, so a signed-in Ekido account changes nothing. A page can therefore
 * read the lists only when it talks to a loopback coordinator directly, as the local demo and tests do. A coordinator
 * on the site's own host (Caddy's `/sepolia`, as on staging) sits behind a proxy that adds X-Forwarded-For. A
 * coordinator on another non-loopback host answers 401. Checked on staging on 24 Nov: 401 with and without a
 * signed-in session, in Chromium, WebKit and Firefox.
 */
export function privateListsOpenTo(coordinatorUrl: string, siteHref: string): boolean {
  try {
    const coordinator = new URL(coordinatorUrl, siteHref);
    return LOOPBACK.has(coordinator.hostname) && coordinator.origin !== new URL(siteHref).origin;
  } catch {
    return false;
  }
}

/** Whether this page may ask for the coordinator's private lists without being refused (privateListsOpenTo). */
export function privateListsReadable(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return Promise.resolve(privateListsOpenTo(config.coordinatorUrl, window.location.href));
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
