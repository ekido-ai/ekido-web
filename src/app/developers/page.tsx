import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { DevelopersSection } from "@/components/landing/platform-sections";
import { ApiReference } from "@/components/developers/api-reference";

export const metadata: Metadata = { title: "Developers", description: "API keys with test and live modes, scoped access and an auditable savings report." };

export default async function DevelopersPage() {
  const t = await getTranslations("pages.developers");
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} />
      <PageSection>
        <DevelopersSection />
      </PageSection>
      <PageSection>
        <ApiReference />
      </PageSection>
    </MarketingPage>
  );
}
