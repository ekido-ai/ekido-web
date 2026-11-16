"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Cpu, Sparkles } from "lucide-react";
import { GPU_CLASSES, suggestedHourly } from "@/lib/pricing";
import { Stagger } from "./stagger";
import { AnimatedNumber } from "@/components/motion/animated-number";

/** Three ways in, as a bento: each card does something before you click it. */
export function StartHere() {
  const [cls, setCls] = useState(GPU_CLASSES[1].id);
  const [hours, setHours] = useState(8);
  const gpu = GPU_CLASSES.find((c) => c.id === cls) ?? GPU_CLASSES[0];
  const monthly = useMemo(() => suggestedHourly(gpu) * hours * 0.25 * 30, [gpu, hours]);

  return (
    <Stagger className="grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
      {/* Rent: the big card, with a live earnings toy. */}
      <div className="group relative overflow-hidden panel lift rounded-3xl border border-[var(--n-line)] p-6 lg:col-span-2 lg:row-span-2">
        <div className="bento-glow" aria-hidden />
        <Cpu className="size-6 text-accent-strong" aria-hidden />
        <h3 className="mt-4 text-2xl font-semibold tracking-tight">Rent out your GPU</h3>
        <p className="mt-2 max-w-md text-[var(--n-ink-2)]">One download, one command. Paid in USDC for every step the network accepts.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-[var(--n-ink-2)]">
            Your GPU
            <select value={cls} onChange={(e) => setCls(e.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--n-line-2)] bg-[var(--n-alt)] px-3 py-2 text-[var(--n-ink)]">
              {GPU_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--n-ink-2)]">
            Hours a day it&apos;s free: <span className="text-[var(--n-ink)] tabular">{hours}</span>
            <input type="range" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-3 block w-full accent-accent-strong" />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--n-slate)]">Estimate at a fair rate, busy a quarter of that time</div>
            <div className="font-mono text-5xl tracking-tight tabular"><AnimatedNumber value={monthly} duration={500} format={(n) => n.toFixed(2)} /><span className="ml-2 text-lg text-[var(--n-ink-2)]">USDC / month</span></div>
          </div>
          <Link href="/provide" className="press btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold">
            Start providing <ArrowUpRight className="nudge size-4" aria-hidden />
          </Link>
        </div>
        <p className="mt-3 text-xs text-[var(--n-slate)]">Not a promise: it depends on demand. Rates: {gpu.source}.</p>
      </div>

      <Link href="/dashboard?at=0&play=1" className="group relative overflow-hidden panel lift rounded-3xl border border-[var(--n-line)] p-6 transition-colors hover:border-[var(--n-line-2)]">
        <Sparkles className="size-6 text-accent-strong" aria-hidden />
        <h3 className="mt-4 text-xl font-semibold tracking-tight">Train a model</h3>
        <p className="mt-2 text-sm text-[var(--n-ink-2)]">Watch a real run survive a dead GPU, then pay only for what was accepted.</p>
        <svg viewBox="0 0 200 60" className="mt-5 w-full" aria-hidden>
          <path d="M0 8 C30 10 40 30 70 34 S120 30 130 44 S170 50 200 52" fill="none" stroke="#3a3c40" strokeWidth="2" />
          <path d="M0 8 C30 10 40 30 70 34 S120 30 130 44 S170 50 200 52" fill="none" stroke="var(--accent)" strokeWidth="2.5" pathLength={100} className="bento-draw" />
        </svg>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--n-ink)]">Watch the run <ArrowUpRight className="nudge size-4" aria-hidden /></span>
      </Link>

      <Link href="/chain" className="group relative overflow-hidden panel lift rounded-3xl border border-[var(--n-line)] p-6 transition-colors hover:border-[var(--n-line-2)]">
        <BadgeCheck className="size-6 text-accent-strong" aria-hidden />
        <h3 className="mt-4 text-xl font-semibold tracking-tight">Check every payout</h3>
        <p className="mt-2 text-sm text-[var(--n-ink-2)]">Proof of reserves, the full journal and each provider&apos;s own terms, read from the chain by your browser.</p>
        <div className="mt-5 flex gap-1" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="bento-block h-6 flex-1 rounded-md bg-[var(--n-alt)]" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--n-ink)]">Open the ledger <ArrowUpRight className="nudge size-4" aria-hidden /></span>
      </Link>
    </Stagger>
  );
}
