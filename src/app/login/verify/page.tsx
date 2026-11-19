import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { VerifySignIn } from "@/components/auth/verify-sign-in";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Signing in", robots: { index: false } };

export default async function VerifyPage() {
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{t("verifyTitle")}</h1>
      <Panel>
        <div className="p-6">
          {/* The token is in the URL, which is only known in the browser; Suspense keeps the page prerenderable. */}
          <Suspense fallback={<p className="text-ink-2">{t("verifying")}</p>}>
            <VerifySignIn />
          </Suspense>
        </div>
      </Panel>
    </div>
  );
}
