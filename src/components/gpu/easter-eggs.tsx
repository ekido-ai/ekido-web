"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useDashboard } from "@/lib/events/source-context";

/*
 * Small things for people who poke around. None of them change data or money.
 *  - Type "nvidia-smi" anywhere: a terminal with the dashboard's own GPU readings.
 *  - The Konami code: overclock mode (the chips run hot and red). Again to cool down.
 *  - Click the live GPU five times quickly: the fans spin up.
 */

let overclock = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function useOverclock(): boolean {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => overclock, () => false);
}

let toastFn: ((t: string) => void) | null = null;
export function eggToast(text: string) {
  toastFn?.(text);
}

let clicks: number[] = [];
/** Call from a click on the live GPU. Five within two seconds spins the fans. */
export function chipPoke() {
  const now = Date.now();
  clicks = [...clicks.filter((t) => now - t < 2000), now];
  if (clicks.length >= 5) {
    clicks = [];
    eggToast("Fans at 100%. This laptop is now a hair dryer. Thermal throttling postponed.");
  }
}

const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
const WORD = "nvidia-smi";

const CHIP_ASCII = [
  "   ┌─┬─┬─┬─┬─┬─┐",
  "  ─┤ ▓▓▓▓▓▓▓▓▓ ├─",
  "  ─┤ ▓ GPU ▓▓▓ ├─   Ekido",
  "  ─┤ ▓▓▓▓▓▓▓▓▓ ├─   training that survives a dead GPU",
  "   └─┴─┴─┴─┴─┴─┘",
  "",
  "  psst: type nvidia-smi anywhere on the page.",
].join("\n");

export function EasterEggs() {
  const [terminal, setTerminal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    toastFn = (t) => setToast(t);
    try {
      console.log(`%c${CHIP_ASCII}`, "color:#ff6a33;font-family:monospace;font-size:12px");
    } catch {}
    let keys: string[] = [];
    let typed = "";
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "Escape") setTerminal(false);
      const k = e.key.toLowerCase();
      keys = [...keys, k].slice(-KONAMI.length);
      if (keys.join() === KONAMI.join()) {
        keys = [];
        overclock = !overclock;
        document.documentElement.toggleAttribute("data-overclock", overclock);
        emit();
        setToast(overclock ? "Overclock mode on. Every core at 110%. Warranty void, but it's a testnet." : "Back to stock clocks. The fans thank you.");
      }
      if (k.length === 1) {
        typed = (typed + k).slice(-WORD.length);
        if (typed === WORD) {
          typed = "";
          setTerminal(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      toastFn = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <>
      {toast && (
        <div role="status" className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-[#ff6a33]/50 bg-black/90 px-4 py-2 text-sm text-white shadow-[0_0_40px_rgba(255,106,51,0.35)]">
          {toast}
        </div>
      )}
      {terminal && <SmiTerminal onClose={() => setTerminal(false)} />}
    </>
  );
}

function pad(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function SmiTerminal({ onClose }: { onClose: () => void }) {
  const { state, mode } = useDashboard();
  const providers = Object.values(state.providers);
  const now = new Date();
  const rows = providers.map((p, i) => {
    const t = state.telemetry[p.provider_id];
    const cap = p.gpu.cap_mib ?? p.gpu.vram_mib;
    const used = t?.mem_used_mib != null ? `${Math.round(t.mem_used_mib)}MiB` : "  ?MiB";
    return [
      `| ${pad(String(i), 3)} ${pad(p.gpu.model.replace(/^NVIDIA GeForce /, ""), 24)} ${pad(p.name.replace(/ \(.*\)$/, ""), 12)} |`,
      `| ${pad(t?.temp_c != null ? `${Math.round(t.temp_c)}C` : "?C", 6)} ${pad(t?.power_w != null ? `${Math.round(t.power_w)}W` : "?W", 6)} ${pad(`${used} / ${cap}MiB`, 20)} ${pad(t?.util_pct != null ? `${Math.round(t.util_pct)}%` : "?%", 5)} ${pad(p.status, 1)} |`,
      "+-------------------------------------------------+",
    ].join("\n");
  });
  const text = [
    now.toString().slice(0, 24),
    "+-------------------------------------------------+",
    "| Ekido-SMI      readings from the dashboard   |",
    `| source: ${pad(mode === "replay" ? "recording of the 4 Nov run" : "live coordinator", 39)} |`,
    "+-------------------------------------------------+",
    "| GPU Name                     Provider            |",
    "| Temp   Power  Memory-Usage         Util  Status  |",
    "+=================================================+",
    ...(rows.length ? rows : ["| No GPUs reporting. Play the recording or start a |", "| job, then type nvidia-smi again.                |", "+-------------------------------------------------+"]),
    "",
    "Self-reported by each provider's agent. Not a proof of hardware.",
  ].join("\n");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label="nvidia-smi" className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-[0_0_80px_rgba(255,106,51,0.25)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/60">
          <span className="font-mono">user@ekido:~$ nvidia-smi</span>
          <button type="button" onClick={onClose} aria-label="Close terminal" className="rounded p-1 hover:bg-white/10 hover:text-white">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.45] text-[#ffb38a]">{text}</pre>
      </div>
    </div>
  );
}
