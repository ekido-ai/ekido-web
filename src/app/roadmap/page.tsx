import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SceneArt } from "@/components/brand/scene-art";
import { ServiceFlow } from "@/components/brand/service-flow";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { RoadmapSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Roadmap", description: "Where Ekido is going: each step starts when the last one is proven." };

export default async function RoadmapPage() {
  const t = await getTranslations("pages.roadmap");
  const tf = await getTranslations("flow");
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} art={<SceneArt name="devices" title="Ekido Devices" />} />
      <PageSection>
        <RoadmapSection />
      </PageSection>
      <PageSection title={tf("title")} sub={tf("sub")}>
        <ServiceFlow />
      </PageSection>
    </MarketingPage>
  );
}
