import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TeamSettings } from "@/components/settings/team-settings";

export const metadata: Metadata = { title: "Settings", description: "Your team, its members and its API keys." };

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-2 text-ink-2">{t("lead")}</p>
      </div>
      <TeamSettings />
    </div>
  );
}
