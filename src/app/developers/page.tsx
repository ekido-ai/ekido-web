import type { Metadata } from "next";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { DevelopersSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Developers", description: "API keys with test and live modes, scoped access and an auditable savings report." };

export default function DevelopersPage() {
  return (
    <MarketingPage>
      <PageHero kicker="Developers" title="Build on Ekido with an API key." sub="Accounts, organisations and scoped keys are live on the public test network. Running models over the API comes with Ekido Host." />
      <PageSection>
        <DevelopersSection />
      </PageSection>
    </MarketingPage>
  );
}
