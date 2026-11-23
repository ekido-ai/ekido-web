"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from "lucide-react";
import { useDashboard, usePlayer, usePlayerSnapshot } from "@/lib/events/source-context";
import { formatClock } from "@/lib/events/describe";
import { momentLabel, momentsOf, type MomentKind } from "@/lib/events/moments";
import { cx } from "@/components/ui/cx";
import { scrubTarget } from "./scrub";

const SPEEDS = [0.5, 1, 2, 4];
const dot: Record<MomentKind, string> = {
  lost: "bg-critical",
  refused: "bg-critical",
  resumed: "bg-good",
  done: "bg-good",
  paid: "bg-good",
};

/**
 * Floating replay transport: play/pause, ±10 s, speed, and a scrubber with the run's key
 * moments marked (click one to jump straight there). Replay mode only.
 */
export function ReplayBar() {
  const view = useDashboard();
  const player = usePlayer();
  const snap = usePlayerSnapshot();
  const track = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const moments = useMemo(() => momentsOf(player.recording.events), [player]);

  if (view.mode !== "replay" || snap.durationMs <= 0) return null;

  const dur = snap.durationMs;
  const pct = (ms: number) => `${(Math.min(Math.max(ms, 0), dur) / dur) * 100}%`;
  const msAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * dur);
  };
  const toggle = () => (snap.playing ? player.pause() : player.play());

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press shadow-soft fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-line bg-surface/95 px-4 py-2 text-sm text-ink backdrop-blur"
      >
        {snap.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        <span className="tabular">{formatClock(snap.positionMs)}</span>
        <span className="text-muted">Replay</span>
      </button>
    );
  }

  return (
    <div className="replay-bar fixed inset-x-0 bottom-3 z-30 px-3 sm:bottom-4 sm:px-6" role="region" aria-label="Replay controls">
      <div className="shadow-soft mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-3 gap-y-0 rounded-2xl border border-line-strong bg-surface px-3 py-2 sm:flex-nowrap sm:gap-x-4 sm:py-2.5">
        <div className="flex items-center gap-1">
          <IconBtn label="Back to the previous moment ([)" onClick={() => jump(-1)}>
            <SkipBack className="size-4" aria-hidden />
          </IconBtn>
          <IconBtn className="hidden sm:grid" label="Back 10 seconds (←)" onClick={() => player.seek(snap.positionMs - 10_000)}>
            <RotateCcw className="size-4" aria-hidden />
          </IconBtn>
          <button
            type="button"
            onClick={toggle}
            aria-label={snap.playing ? "Pause (Space)" : "Play (Space)"}
            title={snap.playing ? "Pause (Space)" : "Play (Space)"}
            className="press grid size-10 place-items-center rounded-full bg-ink text-ink-inverse hover:opacity-90"
          >
            {snap.playing ? <Pause className="size-4" aria-hidden /> : <Play className="ml-0.5 size-4" aria-hidden />}
          </button>
          <IconBtn className="hidden sm:grid" label="Forward 10 seconds (→)" onClick={() => player.seek(snap.positionMs + 10_000)}>
            <RotateCw className="size-4" aria-hidden />
          </IconBtn>
          <IconBtn label="Next moment (])" onClick={() => jump(1)}>
            <SkipForward className="size-4" aria-hidden />
          </IconBtn>
        </div>

        <span className="tabular w-[92px] shrink-0 text-center text-sm text-ink-2">
          {formatClock(snap.positionMs)} <span className="text-muted">/ {formatClock(dur)}</span>
        </span>

        {/* Scrubber with key moments. */}
        <div className="relative order-last w-full px-1 py-[3px] sm:order-none sm:w-auto sm:flex-1 sm:px-0">
          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-label="Replay position"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur / 1000)}
            aria-valuenow={Math.round(snap.positionMs / 1000)}
            aria-valuetext={formatClock(snap.positionMs)}
            // A 24 px tall hit area around the 6 px track, and no browser panning, so a finger can drag it
            // (ekido-ai/ekido-core#128).
            className="group relative h-6 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ink"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              player.seek(msAt(e.clientX));
            }}
            onPointerMove={(e) => {
              setHoverMs(msAt(e.clientX));
              if (e.buttons === 1) player.seek(msAt(e.clientX));
            }}
            onPointerLeave={() => setHoverMs(null)}
            onKeyDown={(e) => {
              const to = scrubTarget(e.key, snap.positionMs, dur);
              if (to === null) return;
              player.seek(to);
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
            <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-150" style={{ width: pct(snap.positionMs) }} />
            <div
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow transition-transform group-hover:scale-125"
              style={{ left: pct(snap.positionMs) }}
            />
            {hoverMs !== null && (
              <div className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-xs tabular text-ink-inverse" style={{ left: pct(hoverMs) }}>
                {formatClock(hoverMs)}
              </div>
            )}
          </div>
          {moments.map((m) => (
            <button
              key={m.seq}
              type="button"
              onClick={() => player.seek(m.offsetMs)}
              className="group/m absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 p-1.5"
              style={{ left: pct(m.offsetMs) }}
              aria-label={`Jump to ${momentLabel[m.kind]} at ${formatClock(m.offsetMs)}`}
            >
              <span className={cx("block size-2.5 rounded-full ring-2 ring-surface transition-transform group-hover/m:scale-150", dot[m.kind], snap.positionMs >= m.offsetMs ? "" : "opacity-60")} />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-ink-inverse group-hover/m:block group-focus-visible/m:block">
                {momentLabel[m.kind]} · {formatClock(m.offsetMs)}
              </span>
            </button>
          ))}
        </div>

        {/* Phones: one button that cycles the speed. */}
        <button
          type="button"
          onClick={() => player.setSpeed(SPEEDS[(SPEEDS.indexOf(snap.speed) + 1) % SPEEDS.length])}
          aria-label={`Speed ${snap.speed}×, tap to change`}
          className="press ml-auto rounded-md bg-surface-2 px-2.5 py-1.5 text-xs font-semibold tabular text-ink sm:hidden"
        >
          {snap.speed}×
        </button>
        <div className="hidden items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 sm:flex" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => player.setSpeed(s)}
              aria-pressed={snap.speed === s}
              className={cx("press rounded-md px-2 py-1 text-xs font-semibold tabular", snap.speed === s ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
            >
              {s}×
            </button>
          ))}
        </div>
        <IconBtn label="Hide replay controls" onClick={() => setOpen(false)}>
          <ChevronDown className="size-4" aria-hidden />
        </IconBtn>
      </div>
    </div>
  );

  function jump(dir: 1 | -1) {
    const pos = snap.positionMs;
    const target =
      dir === 1 ? moments.find((m) => m.offsetMs > pos + 500) : [...moments].reverse().find((m) => m.offsetMs < pos - 1500);
    player.seek(target ? target.offsetMs : dir === 1 ? dur : 0);
  }
}

function IconBtn({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cx("press size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink", className ?? "grid")}>
      {children}
    </button>
  );
}
