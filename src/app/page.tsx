import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Reveal } from "@/components/nexora/reveal";
import { LossStory } from "@/components/nexora/loss-story";
import { CountUp } from "@/components/nexora/count-up";
import { DashboardLink } from "@/components/nexora/dashboard-link";
import { RelayHero } from "@/components/landing/relay-hero";
import { Stagger } from "@/components/landing/stagger";
import { buttonStyles } from "@/components/ui/button-styles";
import { segments } from "@/lib/landing/run-story";

export const metadata: Metadata = {
  title: { absolute: "Ekido · Your own AI model, built by devices people already have" },
  description:
    "Small businesses describe a job in plain words and get a small AI model of their own, trained on idle devices and paid for only when it passes their test.",
};

/*
 * Ekido's front door. The story, in order: what a business gets, the jobs it fits, how it works, why a relay (with
 * the real 4 Nov recording as proof), the quality rule, what device owners get, and honestly where we are.
 * The jobs are the five recipes in ekido-core (recipes.py); the example inputs are illustrations. Every measured
 * number comes from replay/recordings/real-run-2026-11-04.json.
 */

const jobs = [
  { title: "Sort support tickets", lang: "Hinglish", input: "Order abhi tak nahi aaya, 5 din ho gaye", output: "order" },
  { title: "Read invoices", lang: "English", input: "Sharma Traders · INV-2041 · 14 Nov · ₹12,480 · GSTIN …", output: '{ "vendor": "Sharma Traders", "total": 12480, … }' },
  { title: "Write product descriptions", lang: "English", input: "Cotton kurta · indigo · sizes M to XXL", output: "A soft indigo cotton kurta, easy to wear all day…" },
  { title: "Answer customer questions", lang: "Hinglish", input: "Doctor Sunday ko baithte hain?", output: "Haan, Sunday subah 10 se 1 baje tak." },
  { title: "Read review sentiment", lang: "Hinglish", input: "Delivery fast thi, packing thodi weak", output: "neutral" },
];

const steps = [
  { title: "Describe", body: "Say what you need in Hindi, Hinglish or English, with 20 to 50 examples of the right answer.", who: "You" },
  { title: "Plan and price", body: "Our AI assistant turns that into a checked training job with a fixed quote. No surprise bills.", who: "Ekido" },
  { title: "Train", body: "Idle gaming PCs and laptops train a small model, passing the job on like a relay if one stops.", who: "Idle devices" },
  { title: "Verify", body: "The model is scored on examples it never trained on, against a bar agreed before training.", who: "Verifiers" },
  { title: "Own it", body: "Use it as an API or run it on your own machine. Device owners are paid for the work that passed.", who: "You and the owners" },
];

const relayStats = [
  { value: "0.6 s", label: "to notice the device had stopped" },
  { value: "65 s", label: "until training carried on elsewhere" },
  { value: "8", label: "steps lost, out of 400" },
  { value: "90.7%", label: "final accuracy on 2,000 test examples" },
];

const today = [
  "Training that carries on when a device drops out (recorded)",
  "Bad checkpoints refused before anyone is paid",
  "The quality rule: pass your test and beat the untrained model, or a full refund",
  "Payouts and refunds on a public test network, with test money",
  "Five business recipes with their datasets",
];
const building = [
  "Describing a job in plain words to our AI assistant",
  "Uploading your examples, encrypted from your browser",
  "Rupee payments",
  "Phones joining while they charge",
  "Independent verifiers and an external audit",
];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

const H2 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-serif text-[clamp(2rem,3.6vw,3rem)] leading-[1.05] text-ink ${className}`}>{children}</h2>
);

const card = "panel rounded-3xl border border-line";

export default function Landing() {
  return (
    <div className="-mx-4 -mt-5 overflow-x-clip text-ink sm:-mx-6">
      {/* ── Hero: the promise on the left, the relay on the right ── */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <h1 className="font-serif text-[clamp(2.4rem,5vw,4.1rem)] leading-[1.02] text-ink">
            <span className="anim-line"><span style={d(150)}>Your own AI model.</span></span>
            <span className="anim-line"><span style={d(280)}>Built by devices people already have.</span></span>
          </h1>
          <p className="anim-rise mt-5 max-w-xl text-lg leading-relaxed text-ink-2" style={d(420)}>
            Ekido is for small businesses in India. Describe the job in Hindi, Hinglish or English with a few examples. Idle gaming PCs and laptops train a small model that is yours to keep, and you pay only if it passes your test.
          </p>
          <div className="anim-rise mt-7 flex flex-wrap items-center gap-3" style={d(540)}>
            <Link href="#how" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
              See how it works <ArrowUpRight className="nudge size-4" aria-hidden />
            </Link>
            <Link href="/provide" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
              Earn with your idle device
            </Link>
          </div>
          <p className="anim-rise mt-5 text-sm text-muted" style={d(640)}>
            Being built in the open. Runs on a public test network with test money until an independent audit.
          </p>
        </div>
        <div className="anim-fade" style={d(300)}>
          <RelayHero />
        </div>
      </section>

      {/* ── The jobs: the five real recipes ── */}
      <section id="jobs" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-12 sm:px-8">
        <Reveal className="grid gap-4 lg:grid-cols-[1fr_1.3fr] lg:items-end">
          <div><p className="kicker mb-3">What it&apos;s for</p><H2>Built for the work a shop, clinic or support desk does every day.</H2></div>
          <p className="text-lg leading-relaxed text-ink-2">
            A small model trained for one job can do it well, offline if you like, at a fixed price instead of a per-message bill in dollars. These are the first jobs Ekido is built for.
          </p>
        </Reveal>
        <Stagger step={70} className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {jobs.map((j) => (
            <div key={j.title} className={`${card} lift flex flex-col p-5`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-xl leading-tight text-ink">{j.title}</h3>
              </div>
              <span className="mt-1 text-xs text-muted">{j.lang}</span>
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[13px] leading-snug text-ink-2">{j.input}</div>
              <div className="my-1.5 ml-3 h-4 w-0.5 rounded-full bg-accent" aria-hidden />
              <div className="rounded-xl border border-line p-3 font-mono text-[12.5px] leading-snug text-ink [overflow-wrap:anywhere]">{j.output}</div>
            </div>
          ))}
        </Stagger>
        <p className="mt-3 text-xs text-muted">Example inputs, written for this page.</p>
      </section>

      {/* ── How it works: five steps, each with who does it ── */}
      <section id="how" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="kicker mb-3">How it works</p><H2>Describe the job. Get your own model.</H2></div>
          <p className="max-w-md text-ink-2">Five steps, from a few examples to a model you own.</p>
        </Reveal>
        <Stagger step={90} className="mt-10 grid gap-3 md:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.title} className={`${i === 2 ? "theme-dark device" : card} flex flex-col p-5`}>
              <span className="grid size-9 place-items-center rounded-full bg-accent font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 font-serif text-2xl text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
              <p className="kicker mt-auto border-t border-line pt-3 text-[0.72rem]">{s.who}</p>
            </div>
          ))}
        </Stagger>
      </section>

      {/* ── Why a relay: the name, then the real recording ── */}
      <section id="relay" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <div className="theme-dark device p-6 sm:p-10">
          <Reveal className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end">
            <div><p className="kicker mb-3">The idea behind the name</p><H2 className="text-ink">A relay race for training.</H2></div>
            <p className="text-lg leading-relaxed text-ink-2">
              In an ekiden, a Japanese relay race, a sash passes from runner to runner. In Ekido the training job is the sash. Each device saves signed checkpoints as it trains, and when one stops, the next starts from the last good one. Each runner is paid for the leg it ran.
            </p>
          </Reveal>
          <Stagger className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {relayStats.map((s) => (
              <div key={s.value} className="rounded-2xl border border-line bg-surface p-5">
                <div className="font-serif text-3xl tabular text-ink">
                  <CountUp value={s.value} />
                </div>
                <div className="mt-2 text-sm leading-snug text-ink-2">{s.label}</div>
              </div>
            ))}
          </Stagger>
          <div className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Training loss, every step, from the recording</p>
                <h3 className="mt-1 font-serif text-2xl text-ink">On 4 Nov we stopped a run halfway, on purpose.</h3>
              </div>
              <DashboardLink mode="recorded" className="press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                Watch the recorded run <ArrowUpRight className="nudge size-4" aria-hidden />
              </DashboardLink>
            </div>
            <LossStory segments={segments} />
          </div>
          <p className="mt-4 text-xs text-muted">One recorded run with one seed on a local test network: a demonstration, not a benchmark.</p>
        </div>
      </section>

      {/* ── Quality: the rule that makes paying safe ── */}
      <section id="quality" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <div><p className="kicker mb-3">Quality you can trust</p><H2>Good is not enough. It has to be better.</H2></div>
          <p className="text-lg leading-relaxed text-ink-2">
            The test and the bar are fixed before training starts, and everyone can see them. Nobody can move the goalposts later.
          </p>
        </Reveal>
        <div className="mt-10 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className={`${card} p-6`}>
            <p className="font-serif text-4xl text-accent">1</p>
            <h3 className="mt-3 font-serif text-2xl text-ink">Pass your test</h3>
            <p className="mt-2 text-ink-2">Scored on your own examples that it never trained on, against the bar in your quote.</p>
          </div>
          <span className="grid place-items-center font-serif text-4xl text-muted" aria-hidden>+</span>
          <div className={`${card} p-6`}>
            <p className="font-serif text-4xl text-accent">2</p>
            <h3 className="mt-3 font-serif text-2xl text-ink">Beat the base model</h3>
            <p className="mt-2 text-ink-2">It must clearly outperform the same model before training. No credit for what it already knew.</p>
          </div>
          <span className="grid place-items-center font-serif text-4xl text-muted" aria-hidden>=</span>
          <div className="theme-dark device p-6">
            <h3 className="font-serif text-4xl text-accent-text">Paid</h3>
            <p className="mt-3 text-ink-2">Miss either one and the refund is automatic. Device owners are paid only for work that passed.</p>
            <Link href="/quality" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline">
              See a refusal <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Device owners ── */}
      <section id="owners" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal className={`${card} grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center`}>
          <div>
            <p className="kicker mb-3">For device owners</p>
            <H2>Your idle device can earn.</H2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-2">
              A gaming PC or laptop that sits idle most of the day can train models for nearby businesses. You choose the price and when it works, your key never leaves your machine, and you stop whenever you like.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/provide" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
                Join as a device owner <ArrowUpRight className="nudge size-4" aria-hidden />
              </Link>
              <Link href="/earnings" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
                See earnings
              </Link>
            </div>
          </div>
          <ul className="space-y-3 text-[15px] text-ink">
            {[
              "Paid for every training step that passes, nothing for work that's refused",
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
        </Reveal>
      </section>

      {/* ── Where we are ── */}
      <section id="today" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal>
          <p className="kicker mb-3">Honestly</p>
          <H2>Where we are today</H2>
          <p className="mt-3 max-w-2xl text-ink-2">We show what works and say plainly what doesn&apos;t yet.</p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className={`${card} p-6`}>
            <h3 className="font-semibold text-ink">Working now</h3>
            <ul className="mt-4 space-y-3 text-[15px] text-ink-2">
              {today.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${card} p-6`}>
            <h3 className="font-semibold text-ink">Being built</h3>
            <ul className="mt-4 space-y-3 text-[15px] text-muted">
              {building.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-line-strong" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="mx-auto max-w-[1200px] px-4 py-28 sm:px-8">
        <Reveal className="theme-dark device relative overflow-hidden p-10 sm:p-16">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-accent" />
          <h2 className="max-w-3xl font-serif text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.02] text-ink">
            AI that belongs to the people who use it.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-ink-2">Built in the open, one relay leg at a time.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DashboardLink mode="recorded" className="press inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white">
              Watch the recorded run <ArrowUpRight className="nudge size-4" aria-hidden />
            </DashboardLink>
            <a
              href="https://github.com/ekido-ai"
              target="_blank"
              rel="noreferrer"
              className="press inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-ink hover:bg-surface-2"
            >
              Follow the build on GitHub <ArrowUpRight className="nudge size-4" aria-hidden />
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
