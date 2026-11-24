import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SceneArt } from "@/components/brand/scene-art";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to Ekido with a one-time link sent to your email." };

export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <div className="landing mx-auto grid max-w-[1100px] items-center gap-6 py-10 lg:grid-cols-[420px_1fr] lg:gap-10 lg:py-16">
      <div className="space-y-6">
        <div>
          <p className="kicker mb-3">EKIDO</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t("title")}</h1>
          <p className="mt-2 text-ink-2">{t("lead")}</p>
        </div>
        <Panel>
          <div className="p-6">
            <SignInForm />
          </div>
        </Panel>
      </div>
      <div className="hidden min-w-0 lg:block"><div className="w-full">
        <SceneArt name="train" title="Ekido Train" /></div>
      </div>
    </div>
  );
}
