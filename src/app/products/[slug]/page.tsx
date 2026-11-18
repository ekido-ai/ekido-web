import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, CircleDashed } from "lucide-react";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { StatusBadge } from "@/components/shell/marketing-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { PRODUCT_META } from "@/lib/landing/products";
import { getProducts } from "@/lib/landing/products-server";

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
  const others = products.filter((x) => x.key !== p.key);
  return (
    <MarketingPage>
      <PageHero kicker={p.name} title={p.headline} sub={p.line}>
        <StatusBadge status={p.status} />
      </PageHero>

      <PageSection title="What it does">
        <ul className="grid gap-4 sm:grid-cols-2">
          {p.does.map((t) => (
            <li key={t} className="artifact flex gap-3 p-5 text-[15px] text-ink">
              <Check className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection title="Where it stands">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="artifact p-6">
            <h3 className="text-ink">Working today, on the public test network</h3>
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
            <h3 className="text-ink">Coming next</h3>
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

      <PageSection title="The rest of the platform">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {others.map((o) => (
            <Link key={o.key} href={o.href} className="artifact lift p-4">
              <span className="block text-sm font-semibold text-ink">{o.name}</span>
              <span className="mt-1 block text-[13px] leading-snug text-ink-2">{o.line}</span>
            </Link>
          ))}
        </div>
      </PageSection>
    </MarketingPage>
  );
}
