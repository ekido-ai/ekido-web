import type { Metadata } from "next";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { RoadmapSection } from "@/components/landing/platform-sections";

export const metadata: Metadata = { title: "Roadmap", description: "Where Ekido is going: each step starts when the last one is proven." };

export default function RoadmapPage() {
  return (
    <MarketingPage>
      <PageHero kicker="Roadmap" title="Where Ekido is going." sub="Each step starts when the last one is proven." />
      <PageSection>
        <RoadmapSection />
      </PageSection>
    </MarketingPage>
  );
}
