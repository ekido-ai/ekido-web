"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useDashboard } from "@/lib/events/source-context";
import { momentOf, momentText, momentTone, type MomentKind } from "@/lib/events/moments";
import { StatusIcon, type Tone } from "@/components/ui/status";

interface Toast {
  id: number;
  kind: MomentKind;
  tone: Tone;
  title: string;
  detail: string;
}

const bar: Record<string, string> = { critical: "bg-critical", good: "bg-good" };
const LIFE_MS = 6000;

/**
 * Pops a short notice when a key moment happens while you watch (a GPU lost, a result
 * refused, training back, done, paid). Works for replay and live. Seeking doesn't spam:
 * only small, forward steps through the event log raise toasts.
 */
export function MomentToasts() {
  const { state } = useDashboard();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<{ job: string | null; n: number }>({ job: state.jobId, n: state.log.length });
  const nextId = useRef(1);

  useEffect(() => {
    const prev = seen.current;
    const n = state.log.length;
    seen.current = { job: state.jobId, n };
    // A seek, a reset, a new job, or a big catch-up: just resync, no toasts.
    if (state.jobId !== prev.job || n <= prev.n || n - prev.n > 25) return;
    const fresh: Toast[] = [];
    for (const e of state.log.slice(prev.n)) {
      const m = momentOf(e);
      if (!m) continue;
      const t = momentText(m, state);
      fresh.push({ id: nextId.current++, kind: m.kind, tone: momentTone[m.kind], ...t });
    }
    if (!fresh.length) return;
    // Raised from an external store update, so batch it after the commit.
    const id = requestAnimationFrame(() => setToasts((all) => [...fresh.reverse(), ...all].slice(0, 2)));
    return () => cancelAnimationFrame(id);
  }, [state]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((all) => all.slice(0, -1)), LIFE_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <div className="pointer-events-none fixed bottom-36 right-3 z-40 flex w-[min(360px,calc(100vw-24px))] flex-col-reverse gap-2 sm:bottom-24 sm:right-6" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast-in shadow-soft pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border border-line bg-surface/95 py-3 pl-4 pr-10 backdrop-blur">
          <span className={`absolute inset-y-0 left-0 w-1 ${bar[t.tone] ?? "bg-ink-2"}`} aria-hidden />
          <StatusIcon tone={t.tone} className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-ink">{t.title}</p>
            <p className="mt-0.5 text-sm text-ink-2">{t.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            aria-label="Dismiss"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
          <span className="toast-timer absolute bottom-0 left-0 h-0.5 bg-ink/20" style={{ animationDuration: `${LIFE_MS}ms` }} aria-hidden />
        </div>
      ))}
    </div>
  );
}
