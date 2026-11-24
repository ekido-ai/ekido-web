import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SceneArt } from "@/components/brand/scene-art";
import { ServiceFlow } from "@/components/brand/service-flow";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { PricingSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Pricing", description: "Pay for results, not compute: a fixed quote per model and a full refund if it misses your bar." };

export default async function PricingPage() {
  const t = await getTranslations("pages.pricing");
  const tf = await getTranslations("flow");
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} art={<SceneArt name="pay" title="Ekido Pay" />} />
      <PageSection>
        <PricingSection />
      </PageSection>
      <PageSection title={tf("title")} sub={tf("sub")}>
        <ServiceFlow />
      </PageSection>
    </MarketingPage>
  );
}
