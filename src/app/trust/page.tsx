import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SceneArt } from "@/components/brand/scene-art";
import { ServiceFlow } from "@/components/brand/service-flow";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { TrustSection } from "@/components/landing/platform-sections";
import { Approvals, Measured } from "@/components/landing/proof";

export const metadata: Metadata = { title: "Trust and privacy", description: "What protects your money and your data on Ekido, and what is still on its way." };

export default async function TrustPage() {
  const t = await getTranslations("pages.trust");
  const tf = await getTranslations("flow");
  const tp = await getTranslations("proof");
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} art={<SceneArt name="verify" title="Ekido Verify" />} />
      <PageSection id="measured" title={tp("measuredTitle")} sub={tp("measuredSub")}>
        <Measured />
      </PageSection>
      <PageSection title={tp("approveTitle")} sub={tp("approveSub")}>
        <Approvals />
      </PageSection>
      <PageSection>
        <TrustSection />
      </PageSection>
      <PageSection title={tf("title")} sub={tf("sub")}>
        <ServiceFlow />
      </PageSection>
    </MarketingPage>
  );
}
