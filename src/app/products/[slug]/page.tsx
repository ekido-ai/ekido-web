import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, CircleDashed } from "lucide-react";
import { ProductScene } from "@/components/brand/scenes";
import { ServiceFlow, ServiceStep } from "@/components/brand/service-flow";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { StatusBadge } from "@/components/shell/marketing-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { PRODUCT_META } from "@/lib/landing/products";
import { getProducts } from "@/lib/landing/products-server";
import { getTranslations } from "next-intl/server";

export function generateStaticParams() {
  return PRODUCT_META.map((p) => ({ slug: p.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getProducts()).find((x) => x.key === slug);
  return p ? { title: p.name, description: p.line } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await getProducts();
  const p = products.find((x) => x.key === slug);
  if (!p) notFound();
  const t = await getTranslations("productPage");
  const tf = await getTranslations("flow");
  const scenes = (await getTranslations("scenes")).raw(slug) as string[];
  return (
    <MarketingPage>
      <PageHero kicker={p.name} title={p.headline} sub={p.line} art={<ProductScene name={slug} labels={scenes} title={p.name} />}>
        <StatusBadge status={p.status} />
      </PageHero>

      <PageSection title={tf("title")} sub={tf("sub")}>
        <ServiceFlow current={slug} />
      </PageSection>

      <PageSection title={t("does")}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {p.does.map((t) => (
            <li key={t} className="artifact flex gap-3 p-5 text-[15px] text-ink">
              <Check className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection title={t("stands")}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="artifact p-6">
            <h3 className="text-ink">{t("today")}</h3>
            <ul className="mt-4 space-y-3 text-[15px] text-ink-2">
              {p.today.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-dashed border-line-strong p-6">
            <h3 className="text-ink">{t("next")}</h3>
            <ul className="mt-4 space-y-3 text-[15px] text-muted">
              {p.next.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {p.app && (
          <Link href={p.app[0]} className={`${buttonStyles("primary", "lg")} press mt-8 rounded-full`}>
            {p.app[1]} <ArrowUpRight className="nudge size-4" aria-hidden />
          </Link>
        )}
      </PageSection>

      <PageSection>
        <ServiceStep current={slug} />
      </PageSection>
    </MarketingPage>
  );
}
