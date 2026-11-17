import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Boxes, Check, Coins, Cpu, EyeOff, FileLock2, KeyRound, Landmark, Layers, Lock, Scale, Server, ShieldCheck, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/shell/marketing-nav";
import { PRODUCTS, type Status } from "@/lib/landing/products";
import { cx } from "@/components/ui/cx";

/*
 * The platform parts of the home page: the product catalogue, developers, trust and privacy, pricing and the roadmap.
 * Statuses are honest (live on the test network, being built, planned). The code sample uses only endpoints that
 * exist in ekido-platform today (API keys and the savings report). Pricing shows how you pay, not amounts: prices are
 * set from measured costs and appear in each quote.
 */

const ICONS: Record<string, typeof Boxes> = { assistant: Sparkles, train: Boxes, verify: BadgeCheck, host: Server, pay: Coins, devices: Cpu };

export function ProductCatalog() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PRODUCTS.map((p) => {
        const Icon = ICONS[p.key] ?? Boxes;
        return (
          <Link key={p.key} href={p.href} className="artifact lift group flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-action text-action-ink">
                <Icon className="size-5" aria-hidden />
              </span>
              <StatusBadge status={p.status} />
            </div>
            <h3 className="mt-5 font-serif text-xl text-ink">{p.name}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{p.line}</p>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-accent-text">
              Learn more <ArrowUpRight className="nudge size-4" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function DevelopersSection() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
      <ul className="space-y-5">
        {[
          { Icon: KeyRound, title: "API keys with test and live modes", body: "Keys start ek_test_ or ek_live_, so a test key can never touch real money." },
          { Icon: ShieldCheck, title: "Scoped access", body: "Give a key only what it needs: jobs, models.read or models.predict." },
          { Icon: Scale, title: "A savings report you can audit", body: "Every number in it links to the raw evidence it came from." },
          { Icon: Layers, title: "Open SDK and CLI", body: "Planned, under an open licence, with a playground and test keys." },
        ].map(({ Icon, title, body }) => (
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
          <span className="ml-3 font-mono text-xs text-muted">terminal</span>
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
        <figcaption className="border-t border-line px-5 py-3 text-xs text-muted">Real endpoints of the Platform API. Running a model over the API is being built.</figcaption>
      </figure>
    </div>
  );
}

const trust: { Icon: typeof Lock; title: string; body: string; status: Status }[] = [
  { Icon: Scale, title: "The bar is set before work starts", body: "Your test and the pass mark are fixed in the quote, so nobody can move the goalposts.", status: "live" },
  { Icon: BadgeCheck, title: "Several verifiers sign off", body: "A payout needs signatures from more than one verifier; one bad actor can't approve work alone.", status: "live" },
  { Icon: Landmark, title: "Payouts on a public ledger", body: "Terms, verdict and payout split are recorded where you can check them yourself.", status: "live" },
  { Icon: EyeOff, title: "No public list of devices", body: "Who trains your model isn't published; jobs name devices only by a label.", status: "live" },
  { Icon: Lock, title: "Encrypted in storage and in transit", body: "With our own keys, rotated. Encryption from your browser is next.", status: "live" },
  { Icon: FileLock2, title: "Personal data stripped in your browser", body: "Names and numbers removed before your examples ever upload.", status: "building" },
  { Icon: Layers, title: "Private pools for sensitive data", body: "Train only on devices you trust, or your own.", status: "planned" },
  { Icon: ShieldCheck, title: "Model passport", body: "A record of how your model was trained and tested, that travels with it.", status: "planned" },
];

export function TrustSection() {
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
        The honest limit: a device training your model has to read your examples while it trains. That&apos;s why jobs run only approved training code, and why private pools come before anything sensitive.{" "}
        <Link href="/verify" className="font-semibold text-ink underline-offset-4 hover:underline">Check a payout yourself</Link>
      </p>
    </>
  );
}

export function PricingSection() {
  const plans = [
    {
      name: "Pay per model",
      who: "For a small business",
      price: "Fixed quote",
      note: "Shown before you start",
      points: ["One price to train a model for one job", "Full refund if it misses your bar", "Hosting billed per use, or run it yourself", "Rupees by UPI or card, with GST invoices (coming)"],
      cta: ["Watch a recorded run", "/dashboard?at=0&play=1"],
      featured: true,
    },
    {
      name: "Business",
      who: "For teams and agencies",
      price: "Planned",
      note: "Monthly plan",
      points: ["Team accounts and roles", "Several models and API keys", "Private pools for sensitive data", "Priority support"],
      cta: ["Follow the build", "https://github.com/ekido-ai"],
    },
    {
      name: "Device owners",
      who: "For gaming PCs and laptops",
      price: "Free to join",
      note: "You set your own price",
      points: ["Paid for every training step that passes", "Approved jobs only, stop anytime", "Your key never leaves your machine", "Windows app and phones next"],
      cta: ["Join as a device owner", "/provide"],
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {plans.map((p) => (
        <div key={p.name} className={cx("relative flex flex-col overflow-hidden rounded-3xl p-7", p.featured ? "theme-dark device grain" : "artifact")}>
          {p.featured && <span aria-hidden className="edge-strip absolute inset-x-0 top-0 h-1.5 bg-accent" />}
          <p className="text-sm text-muted">{p.who}</p>
          <h3 className="mt-1 text-xl text-ink">{p.name}</h3>
          <p className="figure mt-5 font-serif text-4xl text-ink">{p.price}</p>
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

export function RoadmapSection() {
  const road = [
    { when: "Now", title: "The foundation", items: ["Relay training and the quality gate", "Payouts and refunds by rule", "Five business recipes", "Accounts, teams and API keys"] },
    { when: "Next", title: "Prove the value", items: ["Describe a job to the assistant", "Rupee payments with UPI", "Hosting and export", "First small businesses"] },
    { when: "Then", title: "The network grows", items: ["A Windows app for device owners", "Android phones while they charge", "Private pools", "Open SDK and playground"] },
    { when: "Later", title: "A model economy", items: ["Marketplace with royalties", "Model passports", "Outside verifiers", "India, then South-East Asia"] },
  ];
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
