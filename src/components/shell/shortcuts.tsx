"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";
import { useDashboard, usePlayer, usePlayerSnapshot } from "@/lib/events/source-context";
import { momentsOf } from "@/lib/events/moments";

const SCREENS = ["/dashboard", "/recovery", "/quality", "/settlement", "/jobs/new"];

const HELP: [string, string][] = [
  ["Space", "Play or pause the replay"],
  ["← / →", "Back or forward 10 seconds"],
  ["[ / ]", "Previous or next key moment"],
  ["1 – 5", "Mission control, Recovery, Quality, Settlement, New job"],
  ["?", "Show or hide this list"],
];

/** Keyboard control for demos, plus a small "?" help sheet. Ignored while typing in a field. */
export function Shortcuts() {
  const router = useRouter();
  const view = useDashboard();
  const player = usePlayer();
  const snap = usePlayerSnapshot();
  const [help, setHelp] = useState(false);
  const moments = useMemo(() => momentsOf(player.recording.events), [player]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const replay = view.mode === "replay";
      const pos = snap.positionMs;

      if (e.key === "?") setHelp((h) => !h);
      else if (e.key === "Escape") setHelp(false);
      else if (/^[1-5]$/.test(e.key)) router.push(SCREENS[Number(e.key) - 1]);
      else if (replay && e.key === " " && !(t && /^(BUTTON|A)$/.test(t.tagName))) {
        if (snap.playing) player.pause();
        else player.play();
      } else if (replay && e.key === "ArrowLeft") player.seek(pos - 10_000);
      else if (replay && e.key === "ArrowRight") player.seek(pos + 10_000);
      else if (replay && e.key === "]") {
        const m = moments.find((x) => x.offsetMs > pos + 500);
        player.seek(m ? m.offsetMs : snap.durationMs);
      } else if (replay && e.key === "[") {
        const m = [...moments].reverse().find((x) => x.offsetMs < pos - 1500);
        player.seek(m ? m.offsetMs : 0);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, view.mode, player, snap, moments]);

  return (
    <>
      <button
        type="button"
        onClick={() => setHelp((h) => !h)}
        aria-label="Keyboard shortcuts (?)"
        title="Keyboard shortcuts (?)"
        className="press hidden size-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink sm:grid"
      >
        <Keyboard className="size-4" aria-hidden />
      </button>
      {help &&
        createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setHelp(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            className="toast-in shadow-soft w-full max-w-md panel rounded-2xl border border-line p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Keyboard shortcuts</h2>
              <button type="button" onClick={() => setHelp(false)} aria-label="Close" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <dl className="mt-4 divide-y divide-line">
              {HELP.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="shrink-0">
                    <kbd className="whitespace-nowrap rounded-md border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink">{k}</kbd>
                  </dt>
                  <dd className="text-right text-sm text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">Replay keys work while the dashboard is replaying a recording.</p>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
