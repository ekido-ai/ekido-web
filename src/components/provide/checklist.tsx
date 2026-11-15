"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cx } from "@/components/ui/cx";

/*
 * Progress you can see, started for you (the first step is already done when you arrive), so finishing feels
 * closer than starting. Ticks stay in this browser only.
 */

const KEY = "ekido.provider-progress";
const STEPS = [
  { id: "price", label: "Chose your GPU and rate", auto: true },
  { id: "kit", label: "Downloaded and checked the kit" },
  { id: "setup", label: "Ran setup" },
  { id: "join", label: "Joined the network" },
  { id: "gas", label: "Added test ETH to list on-chain" },
  { id: "paid", label: "Got your first payout" },
];

export function ProviderChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({ price: true });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
      setDone({ ...saved, price: true });
    } catch {}
  }, []);
  const toggle = (id: string) =>
    setDone((d) => {
      const next = { ...d, [id]: !d[id], price: true };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const count = STEPS.filter((s) => done[s.id]).length;
  const frac = count / STEPS.length;
  const C = 2 * Math.PI * 26;

  return (
    <div className="panel rounded-2xl border border-line p-5">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-3)" strokeWidth="6" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="transition-[stroke-dashoffset] duration-700 ease-out" />
        </svg>
        <div>
          <div className="text-lg font-semibold text-ink">{count === STEPS.length ? "You're a provider" : `${count} of ${STEPS.length} done`}</div>
          <div className="text-sm text-ink-2">{count === STEPS.length ? "Nice. Check the On-chain page for your earnings." : "Tick each step as you finish it."}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-1">
        {STEPS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => !s.auto && toggle(s.id)}
              aria-pressed={!!done[s.id]}
              disabled={s.auto}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className={cx("grid size-5 shrink-0 place-items-center rounded-md border transition-colors", done[s.id] ? "border-transparent bg-good text-white" : "border-line-strong")}>
                {done[s.id] && <Check className="size-3.5" aria-hidden />}
              </span>
              <span className={done[s.id] ? "text-ink-2 line-through decoration-line-strong" : "text-ink"}>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
