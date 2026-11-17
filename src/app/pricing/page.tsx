import type { Metadata } from "next";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { PricingSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Pricing", description: "Pay for results, not compute: a fixed quote per model and a full refund if it misses your bar." };

export default function PricingPage() {
  return (
    <MarketingPage>
      <PageHero kicker="Pricing" title="Pay for results, not compute." sub="Prices are set from measured costs and shown in every quote, before you commit. No token, no per-message bill." />
      <PageSection>
        <PricingSection />
      </PageSection>
    </MarketingPage>
  );
}
