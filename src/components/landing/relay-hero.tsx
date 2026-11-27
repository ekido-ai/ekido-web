"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Gamepad2, Laptop, RotateCcw, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

/*
 * The landing page's one moving moment: Ekido's idea in eight seconds. A gaming PC trains a small model, drops out,
 * and the sash (the job) passes to a laptop, which carries on from the last checkpoint. The model then has to pass the
 * customer's test and beat the untrained model. It is an illustration, labelled as one; the real recording is further
 * down the page. It plays once, can be replayed, and shows the finished state straight away with reduced motion.
 */

type Phase = "pc" | "dropped" | "laptop" | "checking" | "passed";

const TIMELINE: [Phase, number][] = [
  ["pc", 0],
  ["dropped", 2700],
  ["laptop", 3600],
  ["checking", 6600],
  ["passed", 7900],
];

// Each phase's caption is in messages (relay.caption.<phase>).

export function RelayHero() {
  const t = useTranslations("relay");
  const [phase, setPhase] = useState<Phase>("pc");
  const [run, setRun] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("passed");
      return;
    }
    setPhase("pc");
    setRun((r) => r + 1);
    timers.current = TIMELINE.slice(1).map(([p, at]) => setTimeout(() => setPhase(p), at));
  }, []);

  useEffect(() => {
    // Start on the next tick, not inside the effect itself (react-hooks/set-state-in-effect).
    const first = setTimeout(play, 0);
    const pending = timers.current;
    return () => {
      clearTimeout(first);
      pending.forEach(clearTimeout);
    };
  }, [play]);

  const order: Phase[] = ["pc", "dropped", "laptop", "checking", "passed"];
  const reached = (p: Phase) => order.indexOf(phase) >= order.indexOf(p);
  const onLaptop = reached("laptop");
  // Progress: the PC gets to 45%, the laptop takes it to 100%.
  const progress = phase === "pc" ? 45 : phase === "dropped" ? 45 : 100;

  const devices = [
    { key: "pc", name: t("devices.pc"), note: t(reached("dropped") ? "notes.offline" : "notes.training"), Icon: Gamepad2, lost: reached("dropped"), active: !reached("dropped") },
    { key: "laptop", name: t("devices.laptop"), note: t(onLaptop ? (reached("checking") ? "notes.done" : "notes.pickedUp") : "notes.ready"), Icon: Laptop, lost: false, active: onLaptop && !reached("checking") },
    { key: "phone", name: t("devices.phone"), note: t("notes.later"), Icon: Smartphone, lost: false, active: false, later: true },
  ];

  return (
    <figure className="relative" aria-label={t("aria")}>
      <div className="theme-dark device grain relative overflow-hidden p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-ink">{t("job")}</span>
          <button
            type="button"
            onClick={play}
            className="press inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:text-ink"
            aria-label={t("replayAria")}
          >
            <RotateCcw className="size-3.5" aria-hidden /> {t("replay")}
          </button>
        </div>

        <ol className="relative mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          {devices.map(({ key, name, note, Icon, lost, active, later }) => (
            <li
              key={key}
              className={cx(
                "relative rounded-2xl border p-3 transition-all duration-500 sm:p-4",
                active ? "border-accent bg-surface-2" : "border-line bg-surface",
                later && "border-dashed",
              )}
            >
              {/* Dim a lost or later device through its icon and a quieter text colour, never through opacity on the
                  text: faded text fell below 4.5:1 contrast (ekido-ai/ekido-core#102). */}
              <Icon className={cx("size-5 sm:size-6", active ? "text-accent-text" : "text-ink-2", lost && "opacity-45", later && "opacity-60")} aria-hidden />
              <div className={cx("mt-2 text-sm font-semibold sm:text-base", lost || later ? "text-ink-2" : "text-ink")}>{name}</div>
              <div className="mt-0.5 text-xs leading-snug text-muted">{note}</div>
            </li>
          ))}
          {/* The sash: the job itself, carried from one device to the next. */}
          <span
            aria-hidden
            className="relay-sash pointer-events-none absolute -top-1.5 h-2 rounded-full bg-accent shadow-[0_0_18px_rgba(232,98,44,0.6)] transition-[left,opacity] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
            style={{ left: onLaptop ? "calc(33.33% + 0.6rem)" : "0.6rem", width: "calc(33.33% - 2rem)", opacity: phase === "dropped" ? 0.35 : 1 }}
          />
        </ol>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-muted">
            <span>{t("training")}</span>
            <span className="tabular">{progress}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              key={run}
              className="h-full rounded-full bg-accent transition-[width] ease-linear"
              style={{ width: `${progress}%`, transitionDuration: phase === "pc" ? "2600ms" : phase === "laptop" ? "2900ms" : "0ms" }}
            />
          </div>
        </div>

        <div
          className={cx(
            "mt-5 flex items-center gap-3 rounded-2xl border p-4 transition-all duration-500",
            phase === "passed" ? "border-success/40 bg-success/10" : "border-line bg-surface",
          )}
        >
          <BadgeCheck className={cx("size-6 shrink-0", phase === "passed" ? "text-success" : "text-muted")} aria-hidden />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{t(phase === "passed" ? "passed" : "check")}</div>
            <div className="text-xs text-ink-2">{t("checkNote")}</div>
          </div>
        </div>

        <p className="mt-4 min-h-[2.5rem] text-sm text-ink" aria-live="polite">
          {t(`caption.${phase}`)}
        </p>
      </div>
      <figcaption className="mt-2 text-xs text-muted">{t("figcaption")}</figcaption>
    </figure>
  );
}
