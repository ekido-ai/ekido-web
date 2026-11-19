import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { JobArtifacts } from "@/components/landing/job-artifacts";
import { getSolutions } from "@/lib/landing/products-server";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Solutions", description: "Small AI models for retail, clinics, customer support and accounting, in Hindi, Hinglish and English." };

export default async function SolutionsPage() {
  const SOLUTIONS = await getSolutions();
  const t = await getTranslations("pages.solutions");
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} />
      <PageSection title={t("byIndustry")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SOLUTIONS.industries.map((s) => (
            <div key={s.name} className="artifact p-5">
              <h3 className="text-ink">{s.name}</h3>
              <p className="mt-1 text-[15px] text-ink-2">{s.line}</p>
            </div>
          ))}
        </div>
      </PageSection>
      <PageSection title={t("jobsTitle")} sub={t("jobsSub")}>
        <JobArtifacts />
      </PageSection>
      <PageSection title={t("byRole")}>
        <div className="grid gap-3 md:grid-cols-3">
          {SOLUTIONS.roles.map((s) => (
            <Link key={s.name} href={s.href} className="artifact lift p-5">
              <h3 className="text-ink">{s.name}</h3>
              <p className="mt-1 text-[15px] text-ink-2">{s.line}</p>
            </Link>
          ))}
        </div>
      </PageSection>
    </MarketingPage>
  );
}
