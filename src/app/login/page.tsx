import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to Ekido with a one-time link sent to your email." };

export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-2 text-ink-2">{t("lead")}</p>
      </div>
      <Panel>
        <div className="p-6">
          <SignInForm />
        </div>
      </Panel>
    </div>
  );
}
