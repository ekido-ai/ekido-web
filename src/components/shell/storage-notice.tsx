"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const KEY = "ekido.notice";

/**
 * An honest storage notice: no trackers, and the only cookie is the sign-in session, so there's nothing to accept or refuse.
 * It says what is kept and goes away for good after one click.
 */
const noSubscribe = () => () => {};

function wantsNotice() {
  try {
    return !localStorage.getItem(KEY) && !new URLSearchParams(location.search).has("at");
  } catch {
    // Storage blocked: showing the notice every visit would nag, so skip it.
    return false;
  }
}

export function StorageNotice() {
  const t = useTranslations("shell.storage");
  // Read from this browser's storage once on the client; the server render never shows the notice.
  const wanted = useSyncExternalStore(noSubscribe, wantsNotice, () => false);
  const [closed, setClosed] = useState(false);
  if (!wanted || closed) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setClosed(true);
  };
  return (
    <div role="region" aria-label={t("aria")} className="fixed bottom-4 left-4 right-4 z-40 sm:right-auto sm:max-w-sm">
      <div className="rounded-xl border border-line-strong bg-surface p-4 shadow-soft">
        <p className="flex items-start gap-2 text-sm text-ink">
          <Cookie className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
          <span>
            {t("text")}{" "}
            <Link href="/privacy#cookies" className="underline underline-offset-4" onClick={close}>
              {t("link")}
            </Link>
          </span>
        </p>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="primary" onClick={close}>
            {t("ok")}
          </Button>
        </div>
      </div>
    </div>
  );
}
