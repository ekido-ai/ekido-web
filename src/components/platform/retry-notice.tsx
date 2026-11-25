"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button-styles";

const systemNow = () => Date.now();

/** "12:05" for a wait under an hour, "1:02:05" past it. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * A rate limit, shown as a pause rather than an error: what happened in plain words, a countdown that ticks down
 * with a bar, and the button to try again, which turns on when the wait is over. Screen readers hear the wait once,
 * and again when it's over, not every second.
 */
export function RetryNotice({ title, detail, until, againLabel, onAgain, now = systemNow }: {
  title: string;
  detail: string;
  /** When the wait ends, in ms since the epoch. */
  until: number;
  againLabel: string;
  onAgain: () => void;
  now?: () => number;
}) {
  const t = useTranslations("shell.wait");
  const [total] = useState(() => Math.max(1, (until - now()) / 1000));
  const [left, setLeft] = useState(() => Math.max(0, (until - now()) / 1000));
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, (until - now()) / 1000);
      setLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until, now]);
  const ready = left <= 0;
  const minutes = Math.ceil(left / 60);
  return (
    <div className="overflow-hidden rounded-xl border border-warning bg-surface-2" role="status" data-state={ready ? "ready" : "waiting"}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-warning">
          <Clock className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-ink-2 [overflow-wrap:anywhere]">{detail}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={buttonStyles(ready ? "primary" : "secondary", "sm")} disabled={!ready} onClick={onAgain}>
              {againLabel}
            </button>
            <span className="text-sm text-ink-2">
              {ready ? (
                t("ready")
              ) : (
                <>
                  <span aria-hidden>{t.rich("in", { time: clock(left), b: (c) => <span className="font-semibold tabular text-ink">{c}</span> })}</span>
                  <span className="sr-only">{t("inMinutes", { minutes })}</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="h-1 bg-surface-3" aria-hidden>
        <div className="h-full bg-warning transition-[width] duration-1000 ease-linear" style={{ width: `${ready ? 100 : ((total - left) / total) * 100}%` }} />
      </div>
    </div>
  );
}
