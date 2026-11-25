import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Layers } from "lucide-react";
import { ProductIcon } from "@/components/brand/product-icons";
import { HeroArt } from "@/components/landing/hero-art";
import { getTranslations } from "next-intl/server";
import { MarketingPage, PageHero, PageSection } from "@/components/landing/page-hero";
import { StatusBadge } from "@/components/shell/marketing-nav";
import { buttonStyles } from "@/components/ui/button-styles";
import { getProducts } from "@/lib/landing/products-server";
import type { Status } from "@/lib/landing/products";

export const metadata: Metadata = {
  title: "Products and services",
  description: "Describe a job, train a small model on idle devices, check it, host it or take it home, and pay only if it passes. The products and the services around them.",
};

/** The job's path, in order. Devices are the supply side, so they sit under the path, not in it. */
const FLOW = ["assistant", "train", "verify", "host", "pay"];

type Service = { name: string; line: string; status: Status; points: string[] };

export default async function ProductsPage() {
  const products = await getProducts();
  const t = await getTranslations("pages.products");
  const homeArt = (await getTranslations("home")).raw("art") as { pc: string; laptop: string; phone: string; check: string; model: string };
  const services = t.raw("services") as Service[];
  const byKey = Object.fromEntries(products.map((p) => [p.key, p]));
  const flow = FLOW.map((k) => byKey[k]).filter(Boolean);
  const devices = byKey.devices;

  return (
    <MarketingPage>
      <PageHero kicker={t("kicker")} title={t("title")} sub={t("sub")} art={<HeroArt labels={homeArt} />}>
        <Link href="/train" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
          {t("ctaApp")} <ArrowUpRight className="nudge size-4" aria-hidden />
        </Link>
        <Link href="/pricing" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
          {t("ctaPricing")}
        </Link>
      </PageHero>

      <PageSection title={t("fitTitle")} sub={t("fitSub")}>
        <div className="artifact overflow-hidden">
          <ol className="grid divide-y divide-line md:grid-cols-5 md:divide-x md:divide-y-0">
            {flow.map((p, i) => {
                return (
                <li key={p.key}>
                  <Link href={p.href} className="group flex h-full flex-col gap-3 p-5 transition-colors hover:bg-surface-2/60">
                    <span className="flex items-center justify-between">
                      <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-ink group-hover:bg-surface-3">
                        <ProductIcon name={p.key} className="size-5" />
                      </span>
                      <span className="text-xs font-semibold text-muted">{i + 1}</span>
                    </span>
                    <span className="text-[15px] font-semibold text-ink">{p.name}</span>
                    <span className="text-[13px] leading-snug text-ink-2">{p.line}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {devices && (
            <Link href={devices.href} className="flex flex-wrap items-center gap-4 border-t border-line bg-surface-2/50 px-5 py-4 transition-colors hover:bg-surface-2">
              <span className="grid size-9 place-items-center rounded-lg bg-surface text-ink">
                <ProductIcon name="devices" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{devices.name}</span>
                <span className="block text-[13px] leading-snug text-ink-2">{t("devicesLine")}</span>
              </span>
              <StatusBadge status={devices.status} />
            </Link>
          )}
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {(t.raw("promise") as { title: string; body: string }[]).map((x) => (
            <li key={x.title} className="flex gap-3 rounded-xl border border-line p-4">
              <Check className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block text-[15px] font-semibold text-ink">{x.title}</span>
                <span className="block text-[14px] leading-snug text-ink-2">{x.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection title={t("productsTitle")} sub={t("productsSub")} id="products">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            return (
              <Link key={p.key} href={p.href} className="artifact lift flex flex-col p-6">
                <span className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink">
                    <ProductIcon name={p.key} className="size-5" />
                  </span>
                  <StatusBadge status={p.status} />
                </span>
                <h3 className="mt-4 text-ink">{p.name}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{p.line}</p>
                <ul className="mt-4 space-y-2 text-[14px] text-ink-2">
                  {p.does.slice(0, 3).map((d) => (
                    <li key={d} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {t("learnMore")} <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            );
          })}
        </div>
      </PageSection>

      <PageSection title={t("servicesTitle")} sub={t("servicesSub")} id="services">
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((s) => (
            <div key={s.name} className={s.status === "planned" ? "rounded-2xl border border-dashed border-line-strong p-6" : "artifact p-6"}>
              <span className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink">
                  <Layers className="size-5" aria-hidden />
                </span>
                <StatusBadge status={s.status} />
              </span>
              <h3 className="mt-4 text-ink">{s.name}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{s.line}</p>
              <ul className="mt-4 space-y-2 text-[14px] text-ink-2">
                {s.points.map((d) => (
                  <li key={d} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface-2/60 p-6">
          <p className="min-w-0 flex-1 text-[15px] text-ink-2">{t("solutionsLine")}</p>
          <Link href="/solutions" className={`${buttonStyles("secondary", "md")} press rounded-full`}>
            {t("solutionsCta")} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </PageSection>
    </MarketingPage>
  );
}
