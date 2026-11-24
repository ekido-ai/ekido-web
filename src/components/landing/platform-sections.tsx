import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Boxes, Check, Coins, Cpu, EyeOff, FileLock2, KeyRound, Landmark, Layers, Lock, Scale, Server, ShieldCheck, Sparkles } from "lucide-react";
import { ProductIcon } from "@/components/brand/product-icons";
import { StatusBadge } from "@/components/shell/marketing-nav";
import { type Status } from "@/lib/landing/products";
import { getProducts } from "@/lib/landing/products-server";
import { cx } from "@/components/ui/cx";
import { getTranslations } from "next-intl/server";

/*
 * The platform parts of the home page: the product catalogue, developers, trust and privacy, pricing and the roadmap.
 * Statuses are honest (live on the test network, being built, planned). The code sample uses only endpoints that
 * exist in ekido-platform today (API keys and the savings report). Pricing shows how you pay, not amounts: prices are
 * set from measured costs and appear in each quote.
 */


export async function ProductCatalog() {
  const PRODUCTS = await getProducts();
  const t = await getTranslations("platform");
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PRODUCTS.map((p) => {
        return (
          <Link key={p.key} href={p.href} className="artifact lift group flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-action text-action-ink">
                <ProductIcon name={p.key} className="size-5" />
              </span>
              <StatusBadge status={p.status} />
            </div>
            <h3 className="mt-5 font-serif text-xl text-ink">{p.name}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{p.line}</p>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-accent-text">
              {t("learnMore")} <ArrowUpRight className="nudge size-4" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export async function DevelopersSection() {
  const t = await getTranslations("platform.developers");
  const items = t.raw("items") as { title: string; body: string }[];
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
      <ul className="space-y-5">
        {[KeyRound, ShieldCheck, Scale, Layers].map((Icon, i) => ({ Icon, ...items[i] })).map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="text-[15px] leading-relaxed text-ink-2">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <figure className="theme-dark device grain overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <span className="size-3 rounded-full bg-[#2c3a47]" />
          <span className="size-3 rounded-full bg-[#2c3a47]" />
          <span className="size-3 rounded-full bg-accent" />
          <span className="ml-3 font-mono text-xs text-muted">{t("terminal")}</span>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-ink-2 sm:p-6">
          <span className="text-muted"># Create a test key in your organisation&apos;s settings, then:</span>
          {"\n"}
          <span className="text-ink">export EKIDO_KEY=ek_test_…</span>
          {"\n\n"}
          <span className="text-muted"># Who am I, and which organisations can this key use?</span>
          {"\n"}
          <span className="text-ink">curl https://ekido.duckdns.org/sepolia/v1/me \</span>
          {"\n"}
          <span className="text-ink">{"  "}-H &quot;Authorization: Bearer $EKIDO_KEY&quot;</span>
          {"\n\n"}
          <span className="text-muted"># What did my model save me? Every figure links to its evidence.</span>
          {"\n"}
          <span className="text-ink">curl https://ekido.duckdns.org/sepolia/v1/models/$MODEL_ID/savings-report \</span>
          {"\n"}
          <span className="text-ink">{"  "}-H &quot;Authorization: Bearer $EKIDO_KEY&quot;</span>
        </pre>
        <figcaption className="border-t border-line px-5 py-3 text-xs text-muted">{t("caption")}</figcaption>
      </figure>
    </div>
  );
}

const TRUST: { Icon: typeof Lock; status: Status }[] = [
  { Icon: Scale, status: "live" },
  { Icon: BadgeCheck, status: "live" },
  { Icon: Landmark, status: "live" },
  { Icon: EyeOff, status: "live" },
  { Icon: Lock, status: "live" },
  { Icon: FileLock2, status: "building" },
  { Icon: Layers, status: "planned" },
  { Icon: ShieldCheck, status: "planned" },
];

export async function TrustSection() {
  const t = await getTranslations("platform.trust");
  const text = t.raw("items") as { title: string; body: string }[];
  const trust = TRUST.map((x, i) => ({ ...x, ...text[i] }));
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {trust.map(({ Icon, title, body, status }) => (
          <div key={title} className="flex flex-col rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <Icon className="size-5 text-accent-text" aria-hidden />
              <StatusBadge status={status} />
            </div>
            <h3 className="mt-4 font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 max-w-3xl text-sm text-muted">
        {t("limit")}{" "}
        <Link href="/verify" className="font-semibold text-ink underline-offset-4 hover:underline">{t("check")}</Link>
      </p>
    </>
  );
}

export async function PricingSection() {
  const t = await getTranslations("platform.pricing");
  const text = t.raw("plans") as { name: string; who: string; price: string; note: string; points: string[]; cta: string }[];
  const links: { href: string; featured?: boolean }[] = [{ href: "/dashboard?at=0&play=1", featured: true }, { href: "https://github.com/ekido-ai" }, { href: "/provide" }];
  const plans = text.map((p, i) => ({ ...p, cta: [p.cta, links[i].href] as const, featured: links[i].featured }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((p) => (
        <div key={p.name} className={cx("relative flex flex-col overflow-hidden rounded-3xl p-7", p.featured ? "theme-dark device grain" : "artifact")}>
          {p.featured && <span aria-hidden className="edge-strip absolute inset-x-0 top-0 h-1.5 bg-accent" />}
          <p className="text-sm text-muted">{p.who}</p>
          <h3 className="mt-1 text-xl text-ink">{p.name}</h3>
          <p className={/\d/.test(p.price) ? "figure mt-5 font-serif text-4xl text-ink" : "mt-5 text-4xl font-bold tracking-tight text-ink"}>{p.price}</p>
          <p className="text-sm text-muted">{p.note}</p>
          <ul className="mb-8 mt-6 space-y-2.5 text-[15px] text-ink-2">
            {p.points.map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <Link
            href={p.cta[1]}
            className={cx(
              "press mt-auto inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold",
              p.featured ? "bg-accent text-white" : "border border-line text-ink hover:bg-surface-2",
            )}
          >
            {p.cta[0]} <ArrowUpRight className="nudge size-4" aria-hidden />
          </Link>
        </div>
      ))}
    </div>
  );
}

export async function RoadmapSection() {
  const t = await getTranslations("platform.roadmap");
  const road = t.raw("steps") as { when: string; title: string; items: string[] }[];
  return (
    <ol className="relative grid gap-6 md:grid-cols-4">
      <span aria-hidden className="absolute left-0 right-0 top-[18px] hidden h-1 rounded-full bg-surface-3 md:block" />
      <span aria-hidden className="absolute left-0 top-[18px] hidden h-1 w-[18%] rounded-full bg-accent md:block" />
      {road.map((r, i) => (
        <li key={r.when} className="relative">
          <span className={cx("relative grid size-10 place-items-center rounded-full font-bold ring-[6px] ring-bg", i === 0 ? "bg-accent text-white" : "border-2 border-accent bg-surface text-accent-text")}>{i + 1}</span>
          <p className="kicker mt-5 text-[0.72rem]">{r.when}</p>
          <h3 className="mt-1 font-serif text-2xl text-ink">{r.title}</h3>
          <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
            {r.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
