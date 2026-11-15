"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "ekido.notice";

/**
 * An honest storage notice: there are no cookies or trackers, so there's nothing to accept or refuse.
 * It says what is kept and goes away for good after one click.
 */
export function StorageNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY) && !new URLSearchParams(location.search).has("at")) setShow(true);
    } catch {
      // Storage blocked: showing the notice every visit would nag, so skip it.
    }
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };
  return (
    <div role="region" aria-label="Storage notice" className="fixed bottom-4 left-4 right-4 z-40 sm:right-auto sm:max-w-sm">
      <div className="rounded-xl border border-line-strong bg-surface p-4 shadow-soft">
        <p className="flex items-start gap-2 text-sm text-ink">
          <Cookie className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
          <span>
            No cookies, no tracking. We only remember your theme and view in this browser.{" "}
            <Link href="/privacy#cookies" className="underline underline-offset-4" onClick={close}>
              What we store
            </Link>
          </span>
        </p>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="primary" onClick={close}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
