"use client";

import { useState } from "react";
import Link from "next/link";

/*
 * How one job's money moves, as light running between the parts that hold it. Each node opens the page
 * that shows that part for real. Decorative motion only; the words carry the meaning.
 */

const NODES = [
  { id: "client", x: 80, y: 150, label: "Client", sub: "Locks a USDC budget", href: "/jobs/new" },
  { id: "escrow", x: 300, y: 150, label: "Escrow", sub: "Holds it on-chain", href: "/chain" },
  { id: "gpu", x: 520, y: 70, label: "GPUs", sub: "Train, checkpoint, recover", href: "/dashboard" },
  { id: "verify", x: 520, y: 230, label: "Verifiers", sub: "Test the result, 2 of 3 sign", href: "/quality" },
  { id: "paid", x: 740, y: 150, label: "Payout", sub: "Accepted steps only", href: "/settlement" },
] as const;

const EDGES = [
  { from: "client", to: "escrow", d: "M80 150 L300 150", tone: "#ff6a33" },
  { from: "escrow", to: "gpu", d: "M300 150 C400 150 420 70 520 70", tone: "#ff8a4c" },
  { from: "gpu", to: "verify", d: "M520 70 C580 110 580 190 520 230", tone: "#fab219" },
  { from: "verify", to: "paid", d: "M520 230 C620 230 640 150 740 150", tone: "#4ade80" },
  { from: "escrow", to: "paid", d: "M300 150 C420 300 620 300 740 150", tone: "#ff6a33" },
] as const;

const STEPS: Record<string, string> = {
  client: "The client signs the job terms and locks the whole budget in the escrow before any GPU starts.",
  escrow: "The contract holds the money. Not even we can move it; only a verdict signed by the verifiers can.",
  gpu: "Providers train and save signed checkpoints. If one dies, another resumes from the last good one.",
  verify: "Independent verifiers re-test the model against the agreed bar. Junk is refused before it's paid.",
  paid: "Each provider is paid for its accepted steps, the fee is taken only on success, and the rest goes back.",
};

export function MoneyFlow() {
  const [active, setActive] = useState<string>("escrow");
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--n-line)] bg-[var(--n-card)] p-2">
        <svg viewBox="0 0 820 300" className="w-full" role="img" aria-label="Client to escrow to GPUs to verifiers to payout">
          <defs>
            {EDGES.map((e, i) => (
              <linearGradient key={i} id={`mf-g${i}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="820" y2="0">
                <stop offset="0" stopColor={e.tone} stopOpacity="0" />
                <stop offset="0.5" stopColor={e.tone} stopOpacity="1" />
                <stop offset="1" stopColor={e.tone} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {EDGES.map((e, i) => (
            <g key={i}>
              <path d={e.d} fill="none" stroke="#26262a" strokeWidth="2" />
              <path d={e.d} fill="none" stroke={e.tone} strokeWidth="2.5" strokeLinecap="round" pathLength={100} className="mf-beam" style={{ animationDelay: `${i * 0.45}s` }} />
            </g>
          ))}
          {NODES.map((n) => {
            const on = active === n.id;
            return (
              <g key={n.id} className="cursor-pointer" onMouseEnter={() => setActive(n.id)} onFocus={() => setActive(n.id)} onClick={() => setActive(n.id)} tabIndex={0} role="button" aria-label={`${n.label}: ${n.sub}`}>
                <circle cx={n.x} cy={n.y} r={on ? 34 : 28} fill={on ? "#2a1308" : "#141416"} stroke={on ? "#ff6a33" : "#3a3c40"} strokeWidth="2" className="transition-all duration-300" />
                {on && <circle cx={n.x} cy={n.y} r="44" fill="none" stroke="#ff6a33" strokeOpacity="0.35" className="mf-ping" />}
                <text x={n.x} y={n.y + 5} textAnchor="middle" className="fill-[#f2f2f0] text-[13px] font-semibold">{n.label}</text>
                <text x={n.x} y={n.y + 56} textAnchor="middle" className="fill-[#7f838a] text-[11px]">{n.sub}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div aria-live="polite">
        <p className="text-sm text-[var(--n-accent)]">{NODES.find((n) => n.id === active)?.label}</p>
        <p className="mt-2 text-xl leading-snug tracking-tight">{STEPS[active]}</p>
        <Link href={NODES.find((n) => n.id === active)?.href ?? "/chain"} className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/85 hover:border-white/40 hover:text-white">
          See it live
        </Link>
        <p className="mt-4 text-xs text-[var(--n-slate)]">Point at any part of the diagram.</p>
      </div>
    </div>
  );
}
