"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button-styles";
import { ErrorState } from "@/components/ui/states";
import { platform, PlatformError } from "@/lib/platform/api";

/** Finishes email sign-in: trades the one-time token from the link for the session cookie, then opens Settings. */
export function VerifySignIn() {
  const t = useTranslations("auth");
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [failure, setFailure] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // A token works once; React's development double-run must not spend it twice.
    if (!token || started.current) return;
    started.current = true;
    platform
      .verifyEmailSignIn(token)
      .then(() => router.replace("/settings"))
      .catch((error) => setFailure(error instanceof PlatformError && error.status !== 0 ? t("verifyFailed") : error.message));
  }, [token, router, t]);

  if (!token || failure) {
    return (
      <div className="space-y-4">
        <ErrorState title={t("verifyFailedTitle")} detail={token ? failure ?? undefined : t("noToken")} />
        <Link href="/login" className={buttonStyles("primary", "md")}>{t("newLink")}</Link>
      </div>
    );
  }
  return <p className="text-ink-2" role="status">{t("verifying")}</p>;
}
