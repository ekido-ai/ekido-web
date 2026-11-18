import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { TrustSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Trust and privacy", description: "What protects your money and your data on Ekido, and what is still on its way." };

export default async function TrustPage() {
  const t = await getTranslations("pages.trust");
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} />
      <PageSection>
        <TrustSection />
      </PageSection>
    </MarketingPage>
  );
}
