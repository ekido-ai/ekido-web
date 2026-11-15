import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Steps } from "@/components/nexora/steps";
import { Reveal } from "@/components/nexora/reveal";
import { HeroCenter } from "@/components/nexora/hero-demo";
import { LossStory } from "@/components/nexora/loss-story";
import { Playground } from "@/components/nexora/playground";
import { CountUp } from "@/components/nexora/count-up";
import { DashboardLink } from "@/components/nexora/dashboard-link";
import { StartHere } from "@/components/landing/start-here";
import { LiveNetwork } from "@/components/landing/live-network";
import { MoneyFlow } from "@/components/landing/money-flow";
import { Stagger } from "@/components/landing/stagger";
import { buttonStyles } from "@/components/ui/button-styles";
import { segments, ticker } from "@/lib/landing/run-story";

export const metadata: Metadata = {
  title: { absolute: "Ekido · Training that survives failure" },
  description: "Rent spare GPUs and still trust the result: runs that move when a GPU dies, junk that gets refused, pay only for accepted work.",
};

/*
 * Landing page, daylight design, inside the same shell as every other screen (same header, nav and footer),
 * so it reads as the front door of the product, not a separate brochure. Live demos sit on dark "device"
 * cards. Every real number and the chart come from replay/recordings/real-run-2026-11-04.json.
 */

const stats = [
  { value: "0.6 s", label: "to notice the provider had stopped" },
  { value: "65 s", label: "until it was training again (41 s of that checking the checkpoint)" },
  { value: "8", label: "steps lost, out of 400" },
  { value: "24.8%", label: "accuracy of the junk checkpoint. Refused. The one before was 89.2%" },
  { value: "90.7%", label: "final accuracy, on 2,000 test examples" },
];

/*
 * The market problem, from research on 9 Nov 2026 (docs/market-problem.md). Each "today" links its source;
 * each answer links the screen that shows it working.
 */
const compare: { group: string; rows: { when: string; today: string; src?: [string, string]; ours: string; proof: [string, string] }[] }[] = [
  {
    group: "Renting a GPU",
    rows: [
      { when: "The GPU disappears mid-run", today: "Marketplace hosts can be stopped at any time. Saving and resuming is left to you.", src: ["https://clusterbid.com/blog/vast-ai-gpu-marketplace-deep-dive-decentralized-pricing-reliability", "ClusterBid"], ours: "Another provider resumes from the last trusted checkpoint, even on a different GPU.", proof: ["/recovery", "See a recovery"] },
      { when: "You pay for time, not results", today: "Billing runs every few minutes whether the run works. Spent credits aren't refunded.", src: ["https://docs.vast.ai/documentation/reference/billing", "Vast.ai billing"], ours: "You pay per accepted step from a locked budget. The rest comes back to you.", proof: ["/settlement", "See a payout"] },
      { when: "Bad work looks like good work", today: "GPUs differ, so results can't be recomputed exactly. Most networks fall back on reputation.", src: ["https://arxiv.org/pdf/2501.05374", "arXiv 2501.05374"], ours: "A statistical test you agree on before the job refuses junk before it's paid.", proof: ["/quality", "See a refusal"] },
    ],
  },
  {
    group: "Paying on a blockchain",
    rows: [
      { when: "Paid in a token that swings", today: "Many networks pay providers in their own token, which puts off hosts who just want dollars.", src: ["https://aethir.com/blog-posts/aethir-and-maitrix-launch-ausd-stability-for-decentralized-gpu-infrastructure", "Aethir"], ours: "Budgets and payouts are in USDC, a dollar stablecoin. There's no Ekido token.", proof: ["/chain", "See the ledger"] },
      { when: "Rewarded for showing up", today: "Token emissions pay nodes for existing, which invites fake ones.", src: ["https://www.tokenomics.net/guides/depin-tokenomics/", "Tokenomics.net"], ours: "Nothing is minted. Every payout comes out of a client's budget for accepted work, so a fake node earns zero.", proof: ["/chain#reserves", "See where money came from"] },
      { when: "The chain can't see the work", today: "Corrupted renders were returned on one network in 2025, with no on-chain way to catch them.", src: ["https://www.tradingview.com/news/cointelegraph:d08daf58e094b:0-decentralized-compute-has-failed-so-far/", "Cointelegraph"], ours: "A payout needs 2 of 3 verifier signatures over the result and a dispute window. Our team runs the verifiers today.", proof: ["/verify", "Check a payout yourself"] },
      { when: "Is the money really there?", today: "You take the platform's word for balances.", ours: "Proof of reserves, read from the chain by your own browser.", proof: ["/chain", "See it live"] },
    ],
  },
];



const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;




const H2 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-serif text-[clamp(2rem,3.6vw,3rem)] leading-[1.05] text-ink ${className}`}>{children}</h2>
);

const card = "panel rounded-3xl border border-line";

export default function Landing() {
  return (
    <div className="-mx-4 -mt-5 overflow-x-clip text-ink sm:-mx-6">
      {/* ── Hero: the chip at the centre, the promise underneath ── */}
      <section className="relative overflow-x-clip pb-14 pt-5 sm:pt-6">
        <div className="anim-fade" style={d(100)}>
          <HeroCenter />
        </div>
        <div className="mx-auto mt-6 max-w-[900px] px-4 text-center sm:px-8">
          <h1 className="font-serif text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.04] text-ink">
            <span className="anim-line"><span style={d(350)}>Train on spare GPUs.</span></span>
            <span className="anim-line"><span style={d(470)}>Pay only for what <span className="text-grad-lime shimmer-text">works.</span></span></span>
          </h1>
          <p className="anim-rise mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-ink-2" style={d(600)}>
            When a GPU dies, your run moves to another one. When work doesn&apos;t hold up, it&apos;s refused. And the money waits in an escrow that pays only for steps that made it into your model.
          </p>
          <div className="anim-rise mt-6 flex flex-wrap items-center justify-center gap-3" style={d(720)}>
            <Link href="/dashboard?at=0&play=1" className={`${buttonStyles("primary", "lg")} press rounded-full`}>
              Watch the recorded run <ArrowUpRight className="nudge size-4" aria-hidden />
            </Link>
            <Link href="/provide" className={`${buttonStyles("secondary", "lg")} press rounded-full`}>
              Rent out your GPU
            </Link>
          </div>
          <p className="anim-rise mt-4 text-sm text-muted" style={d(820)}>Live on Base Sepolia · test USDC only · no token · 8% fee, only when a job succeeds</p>
        </div>
      </section>

      {/* ── Proof: the real run's numbers ─────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { v: "0.6 s", l: "to notice the provider stopped" },
            { v: "65 s", l: "until it was training again elsewhere" },
            { v: "24.8%", l: "junk checkpoint, refused and unpaid" },
            { v: "0.90", l: "USDC paid for accepted steps. 4.10 went back", hi: true },
          ].map((s) => (
            <div key={s.v} className={`${s.hi ? "grad-lime rounded-3xl shadow-[0_18px_40px_-22px_rgba(132,204,22,0.8)]" : card} p-6`}>
              <div className="font-serif text-4xl tabular">
                <CountUp value={s.v} />
              </div>
              <div className={`mt-2 text-sm leading-snug ${s.hi ? "text-accent-ink/75" : "text-ink-2"}`}>{s.l}</div>
            </div>
          ))}
        </Stagger>
        <p className="mt-3 text-xs text-muted">
          Measured on the 4 Nov run: one run, one seed, local chain. <a href="#run" className="underline underline-offset-4">See how</a>
        </p>
      </section>

      {/* ── Ticker ───────────────────────────────────────── */}
      <div className="mt-14 flex min-w-0 items-center border-y border-line bg-surface/70 text-sm text-ink-2">
        <span className="hidden shrink-0 border-r border-line px-6 py-4 text-xs font-semibold text-accent-text sm:block">Run timeline</span>
        <div className="landing-marquee-viewport min-w-0 flex-1 overflow-hidden py-4" aria-label="What happened on the 4 Nov run" tabIndex={0}>
          <div className="landing-marquee flex w-max whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={copy === 1}>
                {ticker.map((e, i) => (
                  <span key={i} className="flex items-center gap-2.5">
                    <span className={`size-1.5 rounded-full ${e.tone === "bad" ? "bg-danger" : e.tone === "good" ? "bg-success" : "bg-[#9ca3af]"}`} />
                    <span className="font-mono text-muted">{e.t}</span>
                    {e.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Start here ───────────────────────────────────── */}
      <section id="start" className="mx-auto max-w-[1200px] scroll-mt-24 space-y-6 px-4 pt-24 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <H2>Start here</H2>
          <p className="max-w-md text-ink-2">Three ways in. Each card does something before you click it.</p>
        </Reveal>
        <StartHere />
        <LiveNetwork />
      </section>

      {/* ── Problem ──────────────────────────────────────── */}
      <section id="problem" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <H2>Cheap GPUs are cheap because nobody stands behind them.</H2>
          <p className="text-lg leading-relaxed text-ink-2">
            A host can vanish an hour in, you pay for the time either way, and nothing tells you if the work is real. Crypto networks added tokens, not answers. Here&apos;s what goes wrong today, with sources, and what Ekido does instead.
          </p>
        </Reveal>
        <div className="mt-12 space-y-10">
          {compare.map((g) => (
            <div key={g.group}>
              <h3 className="mb-4 text-sm font-semibold text-accent-text">{g.group}</h3>
              <Stagger step={80} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.rows.map((r) => (
                  <div key={r.when} className={`${card} lift flex flex-col p-6`}>
                    <p className="font-serif text-xl text-ink">{r.when}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {r.today}
                      {r.src && (
                        <>
                          {" "}
                          <a href={r.src[0]} target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs underline decoration-line-strong underline-offset-4 hover:text-ink">
                            {r.src[1]}
                          </a>
                        </>
                      )}
                    </p>
                    <div className="mt-auto pt-5">
                      <div className="rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed text-ink">
                        {r.ours}{" "}
                        <Link href={r.proof[0]} className="whitespace-nowrap font-semibold text-accent-text underline-offset-4 hover:underline">
                          {r.proof[1]} →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </Stagger>
            </div>
          ))}
        </div>
      </section>

      {/* ── Money flow ───────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-8">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <H2>Where the money goes</H2>
          <p className="max-w-md text-ink-2">Point at any part. Every step happens on-chain or in a signed record you can check.</p>
        </Reveal>
        <div className="theme-dark device p-6 sm:p-10">
          <MoneyFlow />
        </div>
      </section>

      {/* ── Try it ───────────────────────────────────────── */}
      <section id="try" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <H2>Go on, try to break it.</H2>
          <p className="max-w-md text-ink-2">A simulation in your browser, with made-up numbers. Stop a provider or make it cheat, then watch where the work goes and who gets paid.</p>
        </Reveal>
        <div className="theme-dark device p-4 sm:p-8">
          <Playground />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how" className="mx-auto grid max-w-[1200px] scroll-mt-24 gap-14 px-4 pt-28 sm:px-8 lg:grid-cols-[1fr_2.2fr]">
        <Reveal>
          <H2>From failure to payout.</H2>
          <p className="mt-4 max-w-xs text-ink-2">Nobody has to step in. You can watch every step on the dashboard.</p>
        </Reveal>
        <Reveal delay={120} className={`${card} p-6 sm:p-8`}>
          <Steps />
        </Reveal>
      </section>

      {/* ── The real run ─────────────────────────────────── */}
      <section id="run" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-28 sm:px-8">
        <Reveal>
          <H2 className="max-w-3xl">
            On 4 Nov we stopped a training run halfway, on purpose. <span className="text-muted">Then we made the replacement cheat.</span>
          </H2>
        </Reveal>
        <Stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.value} className={`${card} p-5`}>
              <div className="font-serif text-3xl tabular">
                <CountUp value={s.value} />
              </div>
              <div className="mt-2 text-sm leading-snug text-ink-2">{s.label}</div>
            </div>
          ))}
        </Stagger>
        <div className={`${card} mt-6 p-4 sm:p-8`}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted">Training loss, every step, straight from the recording</p>
              <h3 className="mt-1 font-serif text-2xl text-ink">Here&apos;s what that looked like.</h3>
            </div>
            <p className="max-w-sm text-sm text-ink-2">Lower is better. Hover or drag across it to see any step.</p>
          </div>
          <LossStory segments={segments} />
        </div>
        <Reveal className="mt-6 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          The budget was 5 USDC. Provider A got <b className="text-ink">0.15</b> and Provider B <b className="text-ink">0.75</b> for the steps that made it into the model. Provider P got nothing, and{" "}
          <b className="text-ink">4.10</b> went back to the client. It&apos;s one run with one seed on a local chain, so think of it as a demonstration, not a benchmark.
        </Reveal>
      </section>

      {/* ── Honestly ─────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-8">
        <Reveal>
          <H2>Honestly</H2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className={`${card} p-6`}>
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <span className="grad-lime grid size-6 place-items-center rounded-full text-xs">✓</span> What works today
            </h3>
            <ul className="mt-4 space-y-3 text-[15px] text-ink-2">
              {["Kill a provider; a replacement can resume", "Bad checkpoints get refused", "Escrow pays per accepted step, with an 8% fee only on success", "A real job settled on Base Sepolia: 0.12 USDC paid, 0.03 refunded", "A run handed between a T4 and an RTX 3060 and back, recorded", "Timeout refund after the deadline and grace period"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-strong" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${card} p-6`}>
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-xs">…</span> Not done yet
            </h3>
            <ul className="mt-4 space-y-3 text-[15px] text-muted">
              {["A second GPU live on stage (the cross-GPU handover is recorded)", "Independent verifiers (our team runs them for now)", "Running your own code (approved workloads only)", "An audit, or real money"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#cbd5e1]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 py-28 sm:px-8">
        <Reveal className="grad-lime relative overflow-hidden rounded-[2.5rem] p-10 sm:p-16">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/40 blur-3xl" />
          <h2 className="relative max-w-2xl font-serif text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.02] text-accent-ink">Stop a provider. Watch the run carry on.</h2>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <DashboardLink mode="recorded" className="press inline-flex items-center gap-2 rounded-full bg-action px-6 py-3 font-semibold text-white hover:bg-action-hover">
              Watch the recorded run <ArrowUpRight className="nudge size-4" aria-hidden />
            </DashboardLink>
            <DashboardLink mode="live" className="press inline-flex items-center rounded-full border border-accent-ink/25 bg-white/50 px-6 py-3 font-semibold text-accent-ink hover:bg-white/70">
              Open the live dashboard
            </DashboardLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
