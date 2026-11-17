import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, X } from "lucide-react";
import { DashboardLink } from "@/components/nexora/dashboard-link";
import { LogoMark } from "@/components/gpu/logo-mark";
import { RelayHero } from "@/components/landing/relay-hero";
import { ProductPreview, Quote, Result } from "@/components/landing/product-preview";
import { ProductCatalog } from "@/components/landing/platform-sections";
import { buttonStyles } from "@/components/ui/button-styles";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: { absolute: "Ekido · Your own AI model, built by devices people already have" },
  description:
    "Small businesses describe a job in plain words and get a small AI model of their own, trained on idle devices and paid for only when it passes their test.",
};

/*
 * The landing page, and only that (DESIGN.md): a centred hero with the product under it, a proof strip, three feature
 * rows that each show a real piece of the product, a metrics band, the product grid, a comparison, a short FAQ and a
 * call to action. Everything deeper lives on its own page (products, solutions, developers, pricing, trust, roadmap).
 * Measured numbers come from replay/recordings/real-run-2026-11-04.json; product screens use example data and say so.
 */

const wrap = "mx-auto max-w-[1200px] px-4 sm:px-8";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="kicker mb-3">{children}</p>;
}

/** One feature row: copy on one side, a real piece of the product on the other. */
function FeatureRow({ eyebrow, title, body, points, href, cta, flip, children }: {
  eyebrow: string; title: string; body: string; points: string[]; href: string; cta: string; flip?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-ink">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">{body}</p>
        <ul className="mt-6 space-y-2.5 text-[15px] text-ink">
          {points.map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <Link href={href} className="mt-7 inline-flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text">
          {cta} <ArrowRight className="nudge size-4" aria-hidden />
        </Link>
      </div>
      <div className={flip ? "lg:order-1" : ""}>
        <div className="rounded-2xl border border-line bg-surface-2 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

type Row = { eyebrow: string; title: string; body: string; points: string[]; cta: string };

export default async function Landing() {
  const t = await getTranslations("home");
  const row = (k: string) => t.raw(`rows.${k}`) as Row;
  const metrics = t.raw("metrics") as { value: string; label: string }[];
  const faqs = t.raw("faqs") as { q: string; a: string }[];
  const [assistant, train, verify] = [row("assistant"), row("train"), row("verify")];
  return (
    <div className="landing -mx-4 -mt-5 overflow-x-clip text-ink sm:-mx-6">
      {/* ── Hero: centred statement, the product right under it ── */}
      <section className="dot-grid relative border-b border-line">
        <div className={`${wrap} pb-20 pt-20 text-center lg:pt-24`}>
          <Link href="/status" className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:text-ink">
            <span className="size-2 rounded-full bg-success" />
            {t("live")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <h1 className="mx-auto max-w-4xl text-ink">
            {t("title")} <span className="text-muted">{t("titleMuted")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
            {t("lead")}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <DashboardLink mode="recorded" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
              {t("ctaRun")} <ArrowRight className="nudge size-4" aria-hidden />
            </DashboardLink>
            <Link href="/products/devices" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
              {t("ctaEarn")}
            </Link>
          </div>
          <div className="mx-auto mt-16 max-w-5xl text-left">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ── Proof strip ── */}
      <div className="border-b border-line">
        <div className={`${wrap} flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-7 text-sm text-muted`}>
          <span className="font-medium text-ink-2">{t("builtWith")}</span>
          {["Qwen2.5 small models", "LoRA fine-tuning", "llama.cpp", "PyTorch", "Postgres", "Base (Ethereum L2)"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Feature rows ── */}
      <section className={`${wrap} space-y-28 py-28`}>
        <FeatureRow
          {...assistant}
          href="/products/assistant"
        >
          <Quote />
        </FeatureRow>
        <FeatureRow
          flip
          {...train}
          href="/products/train"
        >
          <RelayHero />
        </FeatureRow>
        <FeatureRow
          {...verify}
          href="/products/verify"
        >
          <Result />
        </FeatureRow>
      </section>

      {/* ── Metrics band ── */}
      <section className="border-y border-line bg-surface-2/60">
        <div className={`${wrap} py-16`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-ink">{t("metricsTitle")}</h2>
            <DashboardLink mode="recorded" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text">
              {t("metricsCta")} <ArrowRight className="nudge size-4" aria-hidden />
            </DashboardLink>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="border-l-2 border-accent pl-5">
                <dt className="figure text-[clamp(2rem,3.4vw,2.8rem)] leading-none text-ink">{m.value}</dt>
                <dd className="mt-2 text-sm text-ink-2">{m.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-xs text-muted">{t("metricsNote")}</p>
        </div>
      </section>

      {/* ── The platform ── */}
      <section className={`${wrap} py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>{t("platformEyebrow")}</Eyebrow>
            <h2 className="max-w-2xl text-ink">{t("platformTitle")}</h2>
          </div>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text">
            {t("seePricing")} <ArrowRight className="nudge size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-10">
          <ProductCatalog />
        </div>
      </section>

      {/* ── Compare ── */}
      <section className={`${wrap} pb-28`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface-2/60 p-8">
            <h3 className="text-ink-2">{t("rentTitle")}</h3>
            <ul className="mt-5 space-y-3 text-[15px] text-ink-2">
              {(t.raw("rent") as string[]).map((line) => (
                <li key={line} className="flex gap-3"><X className="mt-0.5 size-4.5 shrink-0 text-muted" aria-hidden />{line}</li>
              ))}
            </ul>
          </div>
          <div className="artifact p-8">
            <h3 className="flex items-center gap-2 text-ink"><LogoMark className="size-5" /> {t("ownTitle")}</h3>
            <ul className="mt-5 space-y-3 text-[15px] text-ink">
              {(t.raw("own") as string[]).map((line) => (
                <li key={line} className="flex gap-3"><Check className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className={`${wrap} pb-28`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>{t("faqEyebrow")}</Eyebrow>
            <h2 className="text-ink">{t("faqTitle")}</h2>
            <p className="mt-4 text-ink-2">
              {t("faqMore")} <Link href="/trust" className="font-semibold text-ink underline-offset-4 hover:underline">{t("faqTrust")}</Link> {t("faqAnd")} <Link href="/pricing" className="font-semibold text-ink underline-offset-4 hover:underline">{t("faqPricing")}</Link>.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing call to action ── */}
      <section className="theme-dark ink-band">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-8 py-20`}>
          <div>
            <h2 className="max-w-2xl text-ink">{t("closeTitle")}</h2>
            <p className="mt-3 text-lg text-ink-2">{t("closeLead")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products/devices" className="press inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white">
              {t("closeEarn")} <ArrowRight className="nudge size-4" aria-hidden />
            </Link>
            <a href="https://github.com/ekido-ai" target="_blank" rel="noreferrer" className="press inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-ink hover:bg-surface-2">
              {t("github")} <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
