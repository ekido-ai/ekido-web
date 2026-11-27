"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

/*
 * Progress you can see, started for you (the first step is already done when you arrive), so finishing feels
 * closer than starting. Ticks stay in this browser only.
 */

const KEY = "ekido.provider-progress";
// Labels are in messages (provide.checklist.steps.<id>).
const STEPS = [
  { id: "price", auto: true },
  { id: "kit" },
  { id: "setup" },
  { id: "join" },
  { id: "gas" },
  { id: "paid" },
];

const noSubscribe = () => () => {};
function readSaved(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}"; // storage can be blocked
  }
}

export function ProviderChecklist() {
  const t = useTranslations("provide.checklist");
  // Read after hydration (the server always renders just the first step), then kept in state once ticked here.
  const savedRaw = useSyncExternalStore(noSubscribe, readSaved, () => "{}");
  const saved = useMemo((): Record<string, boolean> => {
    try {
      return { ...(JSON.parse(savedRaw) as Record<string, boolean>), price: true };
    } catch {
      return { price: true };
    }
  }, [savedRaw]);
  const [ticked, setTicked] = useState<Record<string, boolean> | null>(null);
  const done = ticked ?? saved;
  const toggle = (id: string) =>
    setTicked((t) => {
      const d = t ?? saved;
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
          <div className="text-lg font-semibold text-ink">{count === STEPS.length ? t("done") : t("progress", { count, total: STEPS.length })}</div>
          <div className="text-sm text-ink-2">{count === STEPS.length ? t("doneHint") : t("hint")}</div>
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
              <span className={done[s.id] ? "text-ink-2 line-through decoration-line-strong" : "text-ink"}>{t(`steps.${s.id}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
