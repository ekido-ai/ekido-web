"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Power, RotateCcw } from "lucide-react";
import type { ChipPhase } from "@/components/gpu/gpu-chip";
import { ChipScene } from "@/components/gpu/chip-art";

/*
 * Hero mini-demo: a "GPU" trains, you pull the plug, it recovers on the next provider
 * from the last checkpoint. HeroCenter draws the chip and its control dock from one tiny store.
 * Sped up on purpose; the card says how long the real recovery took.
 */

type Phase = "running" | "off" | "recovering" | "back" | "done";
const NAMES = ["Provider A", "Provider B", "Provider C"];
const COLORS = ["#3987e5", "#eb6834", "#1baf7a"];
const CHECKPOINT_EVERY = 50;
const TOTAL = 400;

interface State {
  phase: Phase;
  provider: number;
  step: number;
  lost: number | null;
  resumeFrom: number | null;
  kills: number;
  /** When the plug was pulled, for the on-stage countdown. */
  offAt: number | null;
}

/** How long the provider stays dark, and how long the reboot flicker lasts. */
const OFF_MS = 3000;
const REBOOT_MS = 1300;

const CHIP: Record<Phase, ChipPhase> = { running: "training", back: "training", off: "off", recovering: "recovering", done: "idle" };

const initialState: State = { phase: "running", provider: 0, step: 112, lost: null, resumeFrom: null, kills: 0, offAt: null };
let state: State = initialState;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
let timers: ReturnType<typeof setTimeout>[] = [];

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      timers.forEach(clearTimeout);
      timers = [];
      // Pending recovery timers cannot leave the simulation stuck when the page remounts.
      state = initialState;
    }
  };
}
const snapshot = () => state;

function advance() {
  if (state.phase !== "running" && state.phase !== "back") return;
  const next = Math.min(TOTAL, state.step + 25);
  set(next === TOTAL ? { step: next, phase: "done" } : { step: next });
}

export function pullThePlug() {
  if (state.phase === "off" || state.phase === "recovering" || state.phase === "done") return;
  const checkpoint = Math.floor(state.step / CHECKPOINT_EVERY) * CHECKPOINT_EVERY;
  set({ phase: "off", lost: state.step - checkpoint, resumeFrom: checkpoint, kills: state.kills + 1, offAt: Date.now() });
  timers.push(setTimeout(() => set({ phase: "recovering" }), OFF_MS));
  timers.push(
    setTimeout(() => set({ phase: "back", provider: (state.provider + 1) % NAMES.length, step: checkpoint, offAt: null }), OFF_MS + REBOOT_MS),
  );
}

function useHero() {
  return useSyncExternalStore(subscribe, snapshot, () => initialState);
}


/**
 * The centred hero: a big chip with its circuits running the width of the page, a glow behind it that turns
 * red when the provider dies, and a slim dock of controls underneath. No box around any of it.
 */
export function HeroCenter() {
  const s = useHero();
  const phase = CHIP[s.phase];
  const name = NAMES[s.provider];
  const color = COLORS[s.provider];
  const busy = s.phase === "off" || s.phase === "recovering";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key.toLowerCase() === "k" && !t?.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? "") && !e.metaKey && !e.ctrlKey && !e.altKey) pullThePlug();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const next = NAMES[(s.provider + 1) % NAMES.length];
  const line =
    s.phase === "done"
      ? { dot: "var(--success)", text: "Run complete", sub: "The simulated run reached step 400. Restart to try it again." }
      : s.phase === "off"
        ? { dot: "var(--danger)", text: `${name} lost power`, sub: "Noticed in 0.6 s on the real run. Fencing it off and finding the last good checkpoint." }
        : s.phase === "recovering"
          ? { dot: "var(--warn)", text: `Moving to ${next}`, sub: `Restoring step ${s.resumeFrom} and checking it before training resumes.` }
          : s.phase === "back"
            ? { dot: "var(--success)", text: `Training on ${name}`, sub: `Resumed at step ${s.resumeFrom}. ${s.lost} steps were redone, and nobody had to step in.` }
            : { dot: "var(--success)", text: `Training on ${name}`, sub: "A simulation in your browser. Pull the plug and watch the run move." };

  return (
    <div className="hero-center chip-lime relative" data-state={s.phase}>
      <p className="relative z-10 mx-auto flex w-max items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-ink-2 shadow-sm backdrop-blur">
        <span className="size-1.5 rounded-full bg-accent-strong" aria-hidden /> Live demo · click the chip or press{" "}
        <kbd className="rounded border border-line px-1 font-mono text-[10px]">K</kbd>
      </p>

      {/* The chip, its glow, and circuits that run the width of the page. */}
      <div className="relative mx-auto h-[250px] sm:h-[300px]">
        <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 size-[420px] rounded-full" aria-hidden />
        {s.phase === "off" && <div key={s.kills} aria-hidden className="kill-ring absolute left-1/2 top-1/2 z-[2] size-[260px] rounded-full" />}
        <button
          type="button"
          onClick={s.phase === "done" ? () => set(initialState) : pullThePlug}
          aria-label={s.phase === "done" ? "Restart simulation" : "Stop the simulated provider"}
          className="hero-chip core-tilt absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 scale-[0.6] cursor-pointer rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/70 sm:scale-[0.78]"
          data-state={s.phase}
        >
          <ChipScene phase={phase} util={0.9} vram={0.62} size={290} fieldWidth={2000} fieldHeight={440} perSide={14} />
        </button>
      </div>

      {/* The dock: status, then the two controls. */}
      <div className="relative z-10 mx-auto w-full max-w-[560px] px-4" aria-live="polite">
        <div className="flex flex-wrap items-center gap-2 rounded-[1.75rem] border border-line bg-surface/85 p-2 pl-4 shadow-[0_20px_50px_-28px_rgba(15,23,41,0.4)] backdrop-blur-xl sm:flex-nowrap sm:rounded-full">
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="relative flex size-2.5 shrink-0">
              {!busy && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-50" style={{ background: line.dot }} />}
              <span className="relative size-2.5 rounded-full transition-colors" style={{ background: line.dot }} />
            </span>
            <span key={line.text} className="anim-rise truncate text-sm font-semibold text-ink">{line.text}</span>
            <span className="hidden font-mono text-xs text-muted sm:inline">{String(s.step).padStart(3, "0")}/{TOTAL}</span>
          </span>
          <button
            type="button"
            onClick={advance}
            disabled={busy || s.phase === "done"}
            className="press rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-40"
          >
            +25 steps
          </button>
          <button
            type="button"
            onClick={s.phase === "done" ? () => set(initialState) : pullThePlug}
            disabled={busy}
            className="press inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-action-ink shadow-[0_10px_24px_-12px_rgba(239,68,68,0.8)] hover:bg-danger disabled:cursor-wait disabled:opacity-50"
          >
            {s.kills > 0 && s.phase === "back" ? <RotateCcw className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
            {s.phase === "off" ? "Offline" : s.phase === "recovering" ? "Recovering" : s.phase === "done" ? "Restart" : s.kills > 0 ? "Pull again" : "Pull the plug"}
          </button>
        </div>
        <div className="mx-6 mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full transition-[width,background-color] duration-300" style={{ width: `${(s.step / TOTAL) * 100}%`, background: s.phase === "off" ? "var(--danger)" : color }} />
        </div>
        <p key={line.sub} className="anim-rise mt-1.5 text-center text-sm text-muted">{line.sub}</p>
      </div>
    </div>
  );
}
