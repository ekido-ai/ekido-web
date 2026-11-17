import type { Metadata } from "next";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { TrustSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Trust and privacy", description: "What protects your money and your data on Ekido, and what is still on its way." };

export default function TrustPage() {
  return (
    <MarketingPage>
      <PageHero kicker="Trust and privacy" title="Proof, not promises." sub="What protects your money and your data, and what is still on its way." />
      <PageSection>
        <TrustSection />
      </PageSection>
    </MarketingPage>
  );
}
