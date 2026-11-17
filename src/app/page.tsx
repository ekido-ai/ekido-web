import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, X } from "lucide-react";
import { LogoMark } from "@/components/gpu/logo-mark";
import { Reveal } from "@/components/nexora/reveal";
import { CountUp } from "@/components/nexora/count-up";
import { DashboardLink } from "@/components/nexora/dashboard-link";
import { RelayHero } from "@/components/landing/relay-hero";
import { JobArtifacts } from "@/components/landing/job-artifacts";
import { ProductPreview } from "@/components/landing/product-preview";
import { FeatureBento } from "@/components/landing/feature-bento";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = {
  title: { absolute: "Ekido · Your own AI model, built by devices people already have" },
  description:
    "Small businesses describe a job in plain words and get a small AI model of their own, trained on idle devices and paid for only when it passes their test.",
};

/*
 * Ekido's front door, built like a product site (DESIGN.md, revised): a hero that shows the app, a proof strip,
 * a feature bento, the relay with the real recording, use cases, device owners, an FAQ and a final call to action.
 * The jobs are the five recipes in ekido-core (recipes.py); example inputs and the product window's data are marked
 * as examples. Every measured number comes from replay/recordings/real-run-2026-11-04.json.
 */

const relayStats = [
  { value: "0.6 s", label: "to notice a device had stopped" },
  { value: "65 s", label: "until training carried on elsewhere" },
  { value: "8", label: "steps lost, out of 400" },
  { value: "90.7%", label: "final accuracy, 2,000 test examples" },
];

const steps = [
  { title: "Describe", body: "Tell the assistant what you need, in your language, with 20 to 50 examples." },
  { title: "Approve the quote", body: "A fixed price and the quality bar, in plain words, before anything starts." },
  { title: "Idle devices train", body: "Gaming PCs and laptops train a small model, handing over if one stops." },
  { title: "It's tested", body: "On your examples it never saw, against the untrained model." },
  { title: "You own it", body: "Download it or call it as an API. Or get a full refund." },
];

const faqs: [string, string][] = [
  ["What is Ekido?", "A way for a small business to get its own small AI model for one job, like sorting support tickets or reading invoices. Idle gaming PCs and laptops do the training, and you pay only if the model passes your test."],
  ["How much data do I need?", "Between 20 and 50 examples of the right answer. Some are kept aside, unseen, to test the model before you pay; a larger model can help turn the rest into more training examples."],
  ["Which languages?", "Hindi, Hinglish and English. Two of the first five jobs, support tickets and clinic questions, are built around Hinglish."],
  ["What if the model isn't good enough?", "Then you don't pay. It has to pass your test and beat the untrained model; if it misses either, the whole budget is refunded automatically."],
  ["Who sees my examples?", "Everything is encrypted in storage and in transit today, and encryption from your browser is being built. The device training your model has to read the examples while it trains, which is why jobs run only on the approved training code."],
  ["Can I use it for my business today?", "Not yet for real money. Ekido runs on a public test network with test money until an independent audit. You can watch a recorded run and follow the build in the open."],
  ["How do device owners get paid?", "For every training step that passes the checks. Work that is refused earns nothing, so there is nothing to gain from faking it."],
];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const wrap = "mx-auto max-w-[1200px] px-4 sm:px-8";

function SectionHead({ kicker, title, sub, center }: { kicker: string; title: React.ReactNode; sub?: React.ReactNode; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="kicker mb-3">{kicker}</p>
      <h2 className="font-serif text-[clamp(2rem,3.6vw,3rem)] leading-[1.05] text-ink">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-ink-2">{sub}</p>}
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="-mx-4 -mt-5 overflow-x-clip text-ink sm:-mx-6">
      {/* ── Hero: the statement, then the app itself, with the brand sash sweeping behind it ── */}
      <section className="relative overflow-hidden pb-20">
        <div className={`${wrap} pt-14 lg:pt-20`}>
          <div className="max-w-4xl">
            <Link
              href="/status"
              className="anim-rise mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 shadow-[0_1px_0_rgba(31,42,51,0.04)] hover:text-ink"
              style={d(40)}
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Live on a public test network
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
            <p className="kicker anim-rise mb-5" style={d(60)}>For small businesses in India</p>
            <h1 className="font-serif text-[clamp(2.6rem,5.4vw,4.75rem)] leading-[0.98] text-ink">
              <span className="anim-line"><span style={d(140)}>Your own AI model.</span></span>{" "}
              <span className="anim-line"><span className="text-muted" style={d(260)}>Built by devices people already have.</span></span>
            </h1>
            <p className="anim-rise mt-6 max-w-2xl text-lg leading-relaxed text-ink-2" style={d(400)}>
              Describe the job in Hindi, Hinglish or English with a few examples. Idle gaming PCs and laptops train a small model that is yours to keep, and you pay only if it passes your test.
            </p>
            <div className="anim-rise mt-8 flex flex-wrap items-center gap-3" style={d(500)}>
              <DashboardLink mode="recorded" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
                Watch a recorded run <ArrowUpRight className="nudge size-4" aria-hidden />
              </DashboardLink>
              <Link href="/provide" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
                Earn with your idle device
              </Link>
            </div>
          </div>
          <div className="relative isolate mt-14">
            {/* The logo's two bands, huge, at its angle: the brand's one loud move. */}
            <div aria-hidden className="hero-sash pointer-events-none absolute left-[62%] top-1/2 -z-10 hidden md:block" />
            <div className="anim-fade" style={d(380)}>
              <ProductPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof strip: what it's built on ── */}
      <div className="border-y border-line bg-surface/60">
        <div className={`${wrap} flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 text-sm text-muted`}>
          <span className="font-medium text-ink-2">Built in the open with</span>
          {["Qwen2.5 small models", "LoRA fine-tuning", "llama.cpp", "PyTorch", "Postgres", "Base (Ethereum L2) for payout proofs"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Product: the bento ── */}
      <section id="product" className={`${wrap} scroll-mt-24 pt-28`}>
        <SectionHead
          center
          kicker="Product"
          title="Everything a small business needs to own its AI."
          sub="One job, one small model, trained for you, tested before you pay."
        />
        <div className="mt-12">
          <FeatureBento />
        </div>
      </section>

      {/* ── Compare: renting AI by the message, or owning a model ── */}
      <section className={`${wrap} pt-28`}>
        <SectionHead center kicker="Why own it" title="Rent AI by the message, or own it." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-line bg-surface-2/60 p-7">
            <h3 className="font-semibold text-ink-2">A big AI subscription</h3>
            <ul className="mt-5 space-y-3.5 text-[15px] text-ink-2">
              {[
                "A bill for every message, in dollars, for as long as you use it",
                "Built English-first; Indian languages often cost more per message",
                "Your customers' messages go to someone else's servers",
                "Stops working when the internet or the account does",
                "You pay whether the answers are good or not",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <X className="mt-0.5 size-4.5 shrink-0 text-muted" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="artifact relative overflow-hidden p-7">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-accent" />
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <LogoMark className="size-5" /> Your own model with Ekido
            </h3>
            <ul className="mt-5 space-y-3.5 text-[15px] text-ink">
              {[
                "One fixed price to train it, agreed before anything starts",
                "Trained on your own examples, in Hindi, Hinglish or English",
                "Runs on your own machine if you want, so messages stay with you",
                "Works offline once it's yours",
                "Pay only if it passes your test; otherwise a full refund",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How it works: five steps beside the relay ── */}
      <section id="how" className={`${wrap} scroll-mt-24 pt-28`}>
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <SectionHead kicker="How it works" title="From a few examples to a model you own." />
            <ol className="mt-10 space-y-1">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-2xl p-3 transition-colors hover:bg-surface">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold text-ink">{s.title}</h3>
                    <p className="text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:sticky lg:top-28">
            <RelayHero />
          </div>
        </div>
      </section>

      {/* ── The relay, proven: the real recording ── */}
      <section className={`${wrap} pt-24`}>
        <div className="theme-dark device grain p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="kicker mb-3">Why it&apos;s called Ekido</p>
              <h2 className="font-serif text-[clamp(1.9rem,3.2vw,2.75rem)] leading-[1.05] text-ink">
                In an ekiden, a Japanese relay race, a sash passes from runner to runner. In Ekido, the job is the sash.
              </h2>
            </div>
            <DashboardLink mode="recorded" className="press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
              Watch the recorded run <ArrowUpRight className="nudge size-4" aria-hidden />
            </DashboardLink>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-[#3a4955] lg:grid-cols-4">
            {relayStats.map((s) => (
              <div key={s.value} className="bg-surface p-5">
                <div className="font-serif text-[clamp(2rem,3.4vw,2.9rem)] leading-none tabular text-ink">
                  <CountUp value={s.value} />
                </div>
                <div className="mt-2 text-sm leading-snug text-ink-2">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Recorded on 4 Nov: we stopped a run halfway on purpose. One run, one seed, local test network: a demonstration, not a benchmark.</p>
        </div>
      </section>

      {/* ── Use cases ── */}
      <section id="use-cases" className={`${wrap} scroll-mt-24 pt-28`}>
        <SectionHead
          kicker="Use cases"
          title="Built for the work a shop, clinic or support desk does every day."
          sub="These five are the first jobs Ekido is built for. A model trained for one job does it well, offline if you like, at a fixed price."
        />
        <div className="mt-12">
          <JobArtifacts />
        </div>
        <p className="mt-3 text-xs text-muted">Example inputs, written for this page.</p>
      </section>

      {/* ── Device owners ── */}
      <section id="owners" className={`${wrap} scroll-mt-24 pt-28`}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead
              kicker="For device owners"
              title="Your idle device can earn."
              sub="A gaming PC or laptop that sits idle most of the day can train models for businesses. You set the price and the hours, your key never leaves your machine, and you stop whenever you like."
            />
            <ul className="mt-7 space-y-3 text-[15px] text-ink">
              {[
                "Paid for every training step that passes, nothing for refused work",
                "Approved training jobs only, never someone else's code",
                "An NVIDIA GPU helps; a plain CPU works too",
                "Phones later, while they charge",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/provide" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
                Join as a device owner <ArrowUpRight className="nudge size-4" aria-hidden />
              </Link>
              <Link href="/earnings" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
                See earnings
              </Link>
            </div>
          </div>
          <figure className="theme-dark device grain overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <span className="size-3 rounded-full bg-[#3a4955]" />
              <span className="size-3 rounded-full bg-[#3a4955]" />
              <span className="size-3 rounded-full bg-accent" />
              <span className="ml-3 font-mono text-xs text-muted">provider kit · Windows</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-ink-2 sm:p-6">
              <span className="text-muted">PS&gt; </span>
              <span className="text-ink">powershell -ExecutionPolicy Bypass -File .\join.ps1 `</span>
              {"\n"}
              <span className="text-ink">{"      "}--coordinator wss://gpuchain.duckdns.org/sepolia `</span>
              {"\n"}
              <span className="text-ink">{"      "}--name &quot;My GPU&quot; --price 0.000002</span>
              {"\n\n"}
              <span className="text-[#7fd49b]">✓</span> Checked this machine: NVIDIA GPU, 6 GB free{"\n"}
              <span className="text-[#7fd49b]">✓</span> Joined as provider-3f9a1c{"\n"}
              <span className="text-accent-text">…</span> Waiting for an approved training job
            </pre>
            <figcaption className="border-t border-line px-5 py-3 text-xs text-muted">The command is the real one from the provider page; the output is an illustration.</figcaption>
          </figure>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className={`${wrap} scroll-mt-24 pt-28`}>
        <SectionHead center kicker="FAQ" title="Questions people ask first." />
        <div className="mx-auto mt-10 max-w-3xl divide-y divide-line rounded-3xl border border-line bg-surface">
          {faqs.map(([q, a]) => (
            <details key={q} className="group px-6 py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final call to action, with the finish tape ── */}
      <section className="pt-28">
        <div className="theme-dark ink-band grain">
          <div className={`${wrap} grid items-end gap-8 py-20 lg:grid-cols-[1.4fr_1fr]`}>
            <div>
              <h2 className="font-serif text-[clamp(2.4rem,5vw,4.25rem)] leading-[1] text-ink">AI that belongs to the people who use it.</h2>
              <p className="mt-4 max-w-xl text-lg text-ink-2">Built in the open. Follow along, or join as a device owner today.</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/provide" className="press inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white">
                Join as a device owner <ArrowUpRight className="nudge size-4" aria-hidden />
              </Link>
              <a
                href="https://github.com/ekido-ai"
                target="_blank"
                rel="noreferrer"
                className="press inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-ink hover:bg-surface-2"
              >
                Follow on GitHub <ArrowUpRight className="nudge size-4" aria-hidden />
              </a>
            </div>
          </div>
          <div aria-hidden className="h-3.5 w-full bg-accent" />
        </div>
      </section>
    </div>
  );
}
