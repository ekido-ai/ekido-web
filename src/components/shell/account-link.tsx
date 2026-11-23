"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { platform } from "@/lib/platform/api";

/**
 * The header's account control. Signed in (the 30-day session cookie is valid), it shows the email and leads to
 * Settings; signed out, it says "Sign in". So a person can always see whether they're signed in.
 */
export function AccountLink({ path, hideOnPhone = false }: { path: string; hideOnPhone?: boolean }) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    platform
      .me()
      .then((me) => live && setEmail(me.email ?? ""))
      .catch(() => live && setEmail(null));
    return () => {
      live = false;
    };
  }, [path]);

  const signedIn = typeof email === "string";
  const here = path.startsWith("/settings") || path.startsWith("/login");
  return (
    <Link
      href={signedIn ? "/settings" : "/login"}
      aria-current={here ? "page" : undefined}
      title={signedIn ? t("headerSignedInAs", { email: email || "" }) : undefined}
      className={cx(
        "h-9 max-w-[9rem] items-center gap-2 truncate rounded-md px-2 text-sm font-medium sm:inline-flex sm:max-w-[14rem] sm:px-2.5",
        hideOnPhone ? "hidden" : "inline-flex",
        here ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {signedIn && <span className="size-2 shrink-0 rounded-full bg-good" aria-hidden />}
      <span className="truncate">{email === undefined ? t("headerSettings") : signedIn ? email || t("headerSettings") : t("headerSignIn")}</span>
    </Link>
  );
}
