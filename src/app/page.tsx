import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, X } from "lucide-react";
import { DashboardLink } from "@/components/nexora/dashboard-link";
import { LogoMark } from "@/components/gpu/logo-mark";
import { RelayHero } from "@/components/landing/relay-hero";
import { ProductPreview, Quote, Result } from "@/components/landing/product-preview";
import { ProductCatalog } from "@/components/landing/platform-sections";
import { buttonStyles } from "@/components/ui/button-styles";

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

const metrics = [
  { value: "0.6 s", label: "to notice a device had stopped" },
  { value: "65 s", label: "until training carried on elsewhere" },
  { value: "8 of 400", label: "training steps lost" },
  { value: "90.7%", label: "final accuracy on 2,000 test examples" },
];

const faqs: [string, string][] = [
  ["What is Ekido?", "A way for a small business to get its own small AI model for one job, like sorting support tickets or reading invoices. Idle gaming PCs and laptops do the training, and you pay only if the model passes your test."],
  ["How much data do I need?", "Between 20 and 50 examples of the right answer. Some are kept aside, unseen, to test the model before you pay."],
  ["Which languages?", "Hindi, Hinglish and English. Two of the first five jobs, support tickets and clinic questions, are built around Hinglish."],
  ["What if the model isn't good enough?", "Then you don't pay. It has to pass your test and beat the untrained model; if it misses either, the whole budget is refunded automatically."],
  ["Can I use it for my business today?", "Not yet for real money. Ekido runs on a public test network with test money until an independent audit."],
];

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

export default function Landing() {
  return (
    <div className="landing -mx-4 -mt-5 overflow-x-clip text-ink sm:-mx-6">
      {/* ── Hero: centred statement, the product right under it ── */}
      <section className="dot-grid relative border-b border-line">
        <div className={`${wrap} pb-20 pt-20 text-center lg:pt-24`}>
          <Link href="/status" className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:text-ink">
            <span className="size-2 rounded-full bg-success" />
            Live on a public test network
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <h1 className="mx-auto max-w-4xl text-ink">
            Your own AI model, <span className="text-muted">built by devices people already have.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
            Ekido trains a small model for one job in your business, in Hindi, Hinglish or English, on idle gaming PCs and laptops. You pay only if it passes your test.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <DashboardLink mode="recorded" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
              Watch a recorded run <ArrowRight className="nudge size-4" aria-hidden />
            </DashboardLink>
            <Link href="/products/devices" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
              Earn with your device
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
          <span className="font-medium text-ink-2">Built in the open with</span>
          {["Qwen2.5 small models", "LoRA fine-tuning", "llama.cpp", "PyTorch", "Postgres", "Base (Ethereum L2)"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Feature rows ── */}
      <section className={`${wrap} space-y-28 py-28`}>
        <FeatureRow
          eyebrow="Ekido Assistant"
          title="Describe the job. Get a fixed quote."
          body="Tell the assistant what you need with a few examples. It turns that into a checked training job, with the quality bar and the price in plain words, before anything runs."
          points={["Hindi, Hinglish or English", "20 to 50 examples is enough", "The bar and the price are fixed up front"]}
          href="/products/assistant"
          cta="Explore Ekido Assistant"
        >
          <Quote />
        </FeatureRow>
        <FeatureRow
          flip
          eyebrow="Ekido Train"
          title="Training that carries on when a device drops out."
          body="Idle gaming PCs and laptops train your model. Each saves signed checkpoints, so when one stops, the next picks up from the last good one, like a relay."
          points={["Small open models, fine-tuned for one job", "Automatic recovery, no work paid twice", "Phones join later, while they charge"]}
          href="/products/train"
          cta="Explore Ekido Train"
        >
          <RelayHero />
        </FeatureRow>
        <FeatureRow
          eyebrow="Ekido Verify"
          title="Good is not enough. It has to be better."
          body="Your model is scored on your own examples that it never trained on, and it must beat the same model before training. Miss either, and the refund is automatic."
          points={["The test is fixed before training starts", "Several verifiers must sign off", "Device owners are paid only for work that passed"]}
          href="/products/verify"
          cta="Explore Ekido Verify"
        >
          <Result />
        </FeatureRow>
      </section>

      {/* ── Metrics band ── */}
      <section className="border-y border-line bg-surface-2/60">
        <div className={`${wrap} py-16`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-ink">We stopped a training run halfway, on purpose.</h2>
            <DashboardLink mode="recorded" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text">
              Watch the recording <ArrowRight className="nudge size-4" aria-hidden />
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
          <p className="mt-8 text-xs text-muted">Recorded on 4 Nov 2026: one run, one seed, on a local test network. A demonstration, not a benchmark.</p>
        </div>
      </section>

      {/* ── The platform ── */}
      <section className={`${wrap} py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>The platform</Eyebrow>
            <h2 className="max-w-2xl text-ink">Six products, one job: a model you own.</h2>
          </div>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-accent-text">
            See pricing <ArrowRight className="nudge size-4" aria-hidden />
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
            <h3 className="text-ink-2">Renting a big AI model</h3>
            <ul className="mt-5 space-y-3 text-[15px] text-ink-2">
              {["A bill for every message, in dollars", "English first; Indian languages often cost more", "Your customers' messages go to someone else's servers", "You pay whether the answers are good or not"].map((t) => (
                <li key={t} className="flex gap-3"><X className="mt-0.5 size-4.5 shrink-0 text-muted" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <div className="artifact p-8">
            <h3 className="flex items-center gap-2 text-ink"><LogoMark className="size-5" /> Owning a model with Ekido</h3>
            <ul className="mt-5 space-y-3 text-[15px] text-ink">
              {["One fixed price to train it", "Trained on your examples, in your customers' language", "Run it on your own machine if you want", "Pay only if it passes your test"].map((t) => (
                <li key={t} className="flex gap-3"><Check className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className={`${wrap} pb-28`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="text-ink">Questions people ask first.</h2>
            <p className="mt-4 text-ink-2">
              More on <Link href="/trust" className="font-semibold text-ink underline-offset-4 hover:underline">trust and privacy</Link> and <Link href="/pricing" className="font-semibold text-ink underline-offset-4 hover:underline">pricing</Link>.
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map(([q, a]) => (
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
            <h2 className="max-w-2xl text-ink">AI that belongs to the people who use it.</h2>
            <p className="mt-3 text-lg text-ink-2">Follow the build, or put your idle device to work.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products/devices" className="press inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white">
              Earn with your device <ArrowRight className="nudge size-4" aria-hidden />
            </Link>
            <a href="https://github.com/ekido-ai" target="_blank" rel="noreferrer" className="press inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-ink hover:bg-surface-2">
              GitHub <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
