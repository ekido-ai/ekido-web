"use client";

import { useEffect, useReducer } from "react";
import { Play, Power, Skull, RotateCcw } from "lucide-react";

/*
 * "Break it yourself": a toy version of the real loop, running in the browser.
 * Train to 200 steps with a checkpoint every 25. Kill the GPU or make the next
 * checkpoint junk, and watch recovery, refusal and the payout change.
 * Same rules as the real system, made-up speeds and prices.
 */

const TOTAL = 200;
const EVERY = 25;
const BUDGET = 1;
const PROVIDERS = [
  { name: "Provider A", color: "#2a78d6", price: 0.002 },
  { name: "Provider B", color: "#eb6834", price: 0.003 },
  { name: "Provider C", color: "#1baf7a", price: 0.0025 },
];

type Phase = "idle" | "running" | "verifying" | "detecting" | "recovering" | "done";
type Tone = "info" | "good" | "bad";
interface Log {
  id: number;
  t: number;
  tone: Tone;
  text: string;
}
interface S {
  phase: Phase;
  step: number;
  cur: number;
  accepted: number;
  credit: number[];
  /** Accepted ranges, for the colored progress bar: [from, to, provider]. */
  ranges: [number, number, number][];
  bad: boolean;
  lost: number;
  refused: number;
  started: number;
  log: Log[];
}

const fresh = (): S => ({ phase: "idle", step: 0, cur: 0, accepted: 0, credit: [0, 0, 0], ranges: [], bad: false, lost: 0, refused: 0, started: 0, log: [] });

type A = { type: "start" } | { type: "tick" } | { type: "verdict" } | { type: "detected" } | { type: "resumed" } | { type: "kill" } | { type: "junk" } | { type: "reset" };

let nextId = 1;
function add(s: S, tone: Tone, text: string): Log[] {
  return [{ id: nextId++, t: s.started ? (Date.now() - s.started) / 1000 : 0, tone, text }, ...s.log].slice(0, 7);
}

function reduce(s: S, a: A): S {
  const p = PROVIDERS[s.cur];
  switch (a.type) {
    case "start": {
      const n = { ...fresh(), phase: "running" as Phase, started: Date.now() };
      return { ...n, log: add(n, "info", `Training starts on ${PROVIDERS[0].name}`) };
    }
    case "tick": {
      if (s.phase !== "running") return s;
      const step = s.step + 1;
      if (step % EVERY === 0) return { ...s, step, phase: "verifying", log: add(s, "info", `Checkpoint at step ${step}, verifiers checking…`) };
      return { ...s, step };
    }
    case "verdict": {
      if (s.phase !== "verifying") return s;
      if (s.bad) {
        const wasted = s.step - s.accepted;
        const cur = (s.cur + 1) % PROVIDERS.length;
        return {
          ...s,
          bad: false,
          refused: s.refused + wasted,
          phase: "recovering",
          log: add(s, "bad", `Refused: ${p.name}'s checkpoint failed the quality test. ${wasted} steps unpaid, moving to ${PROVIDERS[cur].name}`),
          cur,
          step: s.accepted,
        };
      }
      const credit = [...s.credit];
      credit[s.cur] += s.step - s.accepted;
      const ranges: S["ranges"] = [...s.ranges, [s.accepted, s.step, s.cur]];
      const done = s.step >= TOTAL;
      const next = { ...s, credit, ranges, accepted: s.step, phase: (done ? "done" : "running") as Phase };
      return { ...next, log: add(s, "good", done ? "Final checkpoint accepted. Escrow pays out." : `Accepted by both verifiers. ${p.name} gets paid for those steps`) };
    }
    case "kill": {
      if (s.phase !== "running" && s.phase !== "verifying") return s;
      const lost = s.step - s.accepted;
      return { ...s, phase: "detecting", lost: s.lost + lost, bad: false, log: add(s, "bad", `${p.name} stopped answering at step ${s.step}`) };
    }
    case "detected": {
      if (s.phase !== "detecting") return s;
      const cur = (s.cur + 1) % PROVIDERS.length;
      return { ...s, phase: "recovering", cur, step: s.accepted, log: add(s, "info", `Noticed. Rolling back to step ${s.accepted}, moving to ${PROVIDERS[cur].name}`) };
    }
    case "resumed": {
      if (s.phase !== "recovering") return s;
      return { ...s, phase: "running", log: add(s, "good", `Training again on ${p.name} from step ${s.step}`) };
    }
    case "junk": {
      if ((s.phase !== "running" && s.phase !== "verifying") || s.bad) return s;
      return { ...s, bad: true, log: add(s, "bad", `${p.name} will send a junk checkpoint next`) };
    }
    case "reset":
      return fresh();
  }
}

export function Playground() {
  const [s, dispatch] = useReducer(reduce, undefined, fresh);

  useEffect(() => {
    if (s.phase === "running") {
      const t = setInterval(() => dispatch({ type: "tick" }), 55);
      return () => clearInterval(t);
    }
    const wait = { verifying: 650, detecting: 700, recovering: 1300 }[s.phase as "verifying" | "detecting" | "recovering"];
    if (!wait) return;
    const next = { verifying: "verdict", detecting: "detected", recovering: "resumed" }[s.phase as "verifying" | "detecting" | "recovering"] as A["type"];
    const t = setTimeout(() => dispatch({ type: next } as A), wait);
    return () => clearTimeout(t);
  }, [s.phase]);

  const paid = s.credit.map((c, i) => c * PROVIDERS[i].price);
  const totalPaid = paid.reduce((a, b) => a + b, 0);
  const live = s.phase !== "idle" && s.phase !== "done";
  const canAct = s.phase === "running" || s.phase === "verifying";
  const cur = PROVIDERS[s.cur];

  const status: Record<Phase, string> = {
    idle: "Ready when you are",
    running: `Training on ${cur.name}`,
    verifying: "Verifiers checking the checkpoint",
    detecting: `${cur.name} is down`,
    recovering: `Restoring step ${s.accepted} on ${cur.name}`,
    done: "Done. Everyone got paid for what counted.",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]" style={{ "--d": "0ms" } as React.CSSProperties}>
      {/* Left: the run */}
      <div className="rounded-xl border border-[var(--n-line)] bg-[var(--n-card)] p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2.5">
              {live && s.phase !== "detecting" && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: cur.color }} />}
              <span className="relative size-2.5 rounded-full" style={{ background: s.phase === "detecting" ? "#ef4444" : s.phase === "idle" ? "#4b4e53" : s.phase === "done" ? "#16a34a" : cur.color }} />
            </span>
            <p key={status[s.phase]} className="anim-rise font-medium">
              {status[s.phase]}
            </p>
          </div>
          <p className="font-mono text-sm tabular text-[var(--n-slate)]">
            step <span className="text-[var(--n-ink)]">{String(s.step).padStart(3, "0")}</span> / {TOTAL}
          </p>
        </div>

        {/* Progress: accepted ranges in the provider's color, unverified work striped, checkpoints as ticks. */}
        <div className={`relative mt-5 h-9 overflow-hidden rounded-md bg-white/[0.06] ${s.phase === "detecting" ? "shake" : ""}`}>
          {s.ranges.map(([a, b, who], i) => (
            <div key={i} className="absolute inset-y-0 transition-all" style={{ left: `${(a / TOTAL) * 100}%`, width: `${((b - a) / TOTAL) * 100}%`, background: PROVIDERS[who].color }} />
          ))}
          {s.step > s.accepted && (
            <div
              className="stripes absolute inset-y-0"
              style={{
                left: `${(s.accepted / TOTAL) * 100}%`,
                width: `${((s.step - s.accepted) / TOTAL) * 100}%`,
                color: s.phase === "detecting" || (s.bad && s.phase === "verifying") ? "#ef4444" : cur.color,
              }}
            />
          )}
          {Array.from({ length: TOTAL / EVERY - 1 }, (_, i) => (
            <div key={i} className="absolute inset-y-0 w-px bg-black/70" style={{ left: `${(((i + 1) * EVERY) / TOTAL) * 100}%` }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--n-slate)]">
          <span>Solid: accepted and paid</span>
          <span>Striped: not checked yet</span>
          <span>Lines: checkpoints every {EVERY} steps</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {s.phase === "idle" || s.phase === "done" ? (
            <button type="button" onClick={() => dispatch({ type: "start" })} className="press inline-flex items-center gap-2 rounded-md btn-primary px-4 py-2.5 text-sm font-semibold text-white">
              <Play className="size-4" aria-hidden /> {s.phase === "done" ? "Run it again" : "Start training"}
            </button>
          ) : (
            <>
              <button type="button" disabled={!canAct} onClick={() => dispatch({ type: "kill" })} className="press inline-flex items-center gap-2 rounded-md bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-40">
                <Power className="size-4" aria-hidden /> Kill {cur.name}
              </button>
              <button type="button" disabled={!canAct || s.bad} onClick={() => dispatch({ type: "junk" })} className="press inline-flex items-center gap-2 rounded-md border border-[var(--n-line-2)] px-4 py-2.5 text-sm font-semibold hover:bg-white/[0.04] disabled:opacity-40">
                <Skull className="size-4" aria-hidden /> {s.bad ? "Junk on the way…" : "Make it cheat"}
              </button>
            </>
          )}
          {s.phase !== "idle" && (
            <button type="button" onClick={() => dispatch({ type: "reset" })} className="press ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm text-[var(--n-slate)] hover:text-[var(--n-ink)]">
              <RotateCcw className="size-3.5" aria-hidden /> Reset
            </button>
          )}
        </div>

        <ol className="mt-6 space-y-2 border-t border-[var(--n-line)] pt-4 font-mono text-[13px]" aria-live="polite">
          {s.log.length === 0 && <li className="text-[var(--n-slate)]">Nothing yet. Press start, then try to break it.</li>}
          {s.log.map((l) => (
            <li key={l.id} className="anim-rise flex gap-3">
              <span className="tabular text-[var(--n-faint)]">{l.t.toFixed(1).padStart(4, "0")}s</span>
              <span className={l.tone === "bad" ? "text-[#f87171]" : l.tone === "good" ? "text-[#4ade80]" : "text-[var(--n-ink-2)]"}>{l.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Right: the money */}
      <div className="rounded-xl border border-[var(--n-line)] bg-[var(--n-card)] p-6">
        <p className="font-medium">Where the {BUDGET.toFixed(2)} USDC goes</p>
        <p className="mt-1 text-sm text-[var(--n-slate)]">Paid per accepted step. Refused or lost work earns nothing.</p>
        <ul className="mt-5 space-y-4">
          {PROVIDERS.map((p, i) => (
            <li key={p.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                  <span className="text-xs text-[var(--n-slate)]">{p.price} / step</span>
                </span>
                <span className="font-mono tabular">{paid[i].toFixed(3)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(paid[i] / BUDGET) * 100}%`, background: p.color }} />
              </div>
            </li>
          ))}
          <li className="flex items-baseline justify-between border-t border-[var(--n-line)] pt-4 text-sm">
            <span>Back to you</span>
            <span className="font-mono tabular font-semibold">{(BUDGET - totalPaid).toFixed(3)}</span>
          </li>
        </ul>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-white/[0.04] p-3">
            <dt className="text-[var(--n-slate)]">Steps lost to kills</dt>
            <dd className="mt-1 font-mono text-lg tabular">{s.lost}</dd>
          </div>
          <div className="rounded-md bg-white/[0.04] p-3">
            <dt className="text-[var(--n-slate)]">Steps refused</dt>
            <dd className="mt-1 font-mono text-lg tabular">{s.refused}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs leading-relaxed text-[var(--n-slate)]">
          A simplified simulation running in your browser, with made-up speeds and prices. The real run is
          further down.
        </p>
      </div>
    </div>
  );
}
