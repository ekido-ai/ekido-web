import { cx } from "@/components/ui/cx";
import type { ChipPhase } from "./gpu-chip";

/*
 * The GPU as an illustration: a metal package with chunky pins and a glowing die, sitting in a
 * field of circuit traces that carry light while it trains. Drawn in SVG, no image files.
 * Lit cores follow utilization and the memory pads follow VRAM; the real numbers are always printed
 * beside it, so this is decoration, never the only signal.
 */

const COLS = 6;
const SMS = 30;
const rank = Array.from({ length: SMS }, (_, i) => ({ i, r: Math.abs((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1) }))
  .sort((a, b) => a.r - b.r)
  .map((x) => x.i);
const order = new Map(rank.map((i, k) => [i, k]));
const PINS = Array.from({ length: 10 }, (_, k) => 46 + k * 16.5);

export function ChipArt({
  phase,
  util = null,
  vram = null,
  label = "GPUCHAIN",
  className,
}: {
  phase: ChipPhase;
  util?: number | null;
  vram?: number | null;
  label?: string;
  className?: string;
}) {
  const u = phase === "training" ? (util ?? 0.85) : phase === "suspect" ? 0.35 : phase === "recovering" ? 1 : phase === "idle" ? 0.12 : 0;
  const lit = Math.round(u * SMS);
  const mem = phase === "off" ? 0 : Math.round((vram ?? (phase === "training" ? 0.5 : 0.15)) * 6);
  return (
    <svg viewBox="0 0 240 240" className={cx("chip-art block", className)} aria-hidden>
      <defs>
        <linearGradient id="ca-pin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b5f68" />
          <stop offset="0.45" stopColor="#e6e8ee" />
          <stop offset="1" stopColor="#6c707a" />
        </linearGradient>
        <linearGradient id="ca-pin-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b5f68" />
          <stop offset="0.45" stopColor="#e6e8ee" />
          <stop offset="1" stopColor="#6c707a" />
        </linearGradient>
        <linearGradient id="ca-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9dce3" />
          <stop offset="0.35" stopColor="#8d929c" />
          <stop offset="0.7" stopColor="#4b4f57" />
          <stop offset="1" stopColor="#a3a8b1" />
        </linearGradient>
        <linearGradient id="ca-die" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="ca-die-a" />
          <stop offset="1" className="ca-die-b" />
        </linearGradient>
        <linearGradient id="ca-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.2" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.38" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.46" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Pins: ten a side, metal. */}
      {PINS.map((p) => (
        <g key={p}>
          <rect x={p - 4.5} y="10" width="9" height="22" rx="1.5" fill="url(#ca-pin)" />
          <rect x={p - 4.5} y="208" width="9" height="22" rx="1.5" fill="url(#ca-pin)" />
          <rect x="10" y={p - 4.5} width="22" height="9" rx="1.5" fill="url(#ca-pin-v)" />
          <rect x="208" y={p - 4.5} width="22" height="9" rx="1.5" fill="url(#ca-pin-v)" />
        </g>
      ))}

      {/* Package: a bevelled metal frame. */}
      <rect x="26" y="26" width="188" height="188" rx="16" fill="url(#ca-frame)" />
      <rect x="31" y="31" width="178" height="178" rx="12" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
      <rect x="38" y="38" width="164" height="164" rx="9" fill="#0a0a0c" />

      {/* The die: glows from inside, with its own circuitry and 30 cores. */}
      <rect x="46" y="46" width="148" height="148" rx="6" fill="url(#ca-die)" className="ca-die" />
      <g className="ca-etch" fill="none" strokeWidth="1.2">
        <path d="M46 78 H70 L82 66 H110 M194 92 H168 L156 104 H130 M46 160 H64 L76 172 H104 L112 194 M194 150 H176 L164 162 H150 M120 46 V60 L132 72 M88 194 V180 L100 168" />
      </g>
      {Array.from({ length: SMS }, (_, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        const on = (order.get(i) ?? 0) < lit;
        return (
          <rect
            key={i}
            x={60 + c * 20.5}
            y={62 + r * 21}
            width="16"
            height="16"
            rx="2"
            className={cx("gpu-sm ca-sm", on && "is-on")}
            style={{ ["--d" as string]: `${((order.get(i) ?? 0) * 0.137) % 1.3}s`, ["--b" as string]: `${i * 28}ms` }}
          />
        );
      })}
      {/* Six memory pads along the bottom edge of the die: 6 GB. */}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={66 + i * 19} y="173" width="13" height="5" rx="1.5" className={cx("ca-mem", i < mem && "is-on")} />
      ))}
      <rect x="46" y="46" width="148" height="148" rx="6" fill="url(#ca-sheen)" />
      <text x="120" y="190" textAnchor="middle" className="ca-label">{label}</text>
    </svg>
  );
}

/* ── Circuit field ─────────────────────────────────────────────────────── */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t >>> 14) ^ t) / 4294967296 + 0.5;
  };
}

interface Trace { d: string; end: [number, number]; pulse: boolean; delay: number }

/** Traces radiating from a chip of half-size `h` at the centre of a w×h field, deterministic. */
function makeTraces(w: number, hgt: number, half: number, perSide: number, seed: number): { traces: Trace[]; dots: [number, number][] } {
  const r = rng(seed);
  const cx = w / 2;
  const cy = hgt / 2;
  const traces: Trace[] = [];
  const dots: [number, number][] = [];
  // Each side: direction out (dx, dy) and along (ax, ay).
  const sides = [
    { ox: 0, oy: -1, ax: 1, ay: 0 },
    { ox: 0, oy: 1, ax: 1, ay: 0 },
    { ox: -1, oy: 0, ax: 0, ay: 1 },
    { ox: 1, oy: 0, ax: 0, ay: 1 },
  ];
  for (const s of sides) {
    for (let k = 0; k < perSide; k++) {
      const along = -half * 0.9 + (k / (perSide - 1)) * half * 1.8;
      let x = cx + s.ox * (half + 6) + s.ax * along;
      let y = cy + s.oy * (half + 6) + s.ay * along;
      const pts: [number, number][] = [[x, y]];
      const reach = (s.ox !== 0 ? w / 2 : hgt / 2) - half;
      let travelled = 0;
      const segments = 2 + Math.floor(r() * 3);
      // Fan out: bend away from the centre line of the side.
      const fan = Math.sign(along || (r() - 0.5)) * (0.6 + r() * 0.6);
      for (let g = 0; g < segments && travelled < reach * 0.95; g++) {
        const straight = 18 + r() * reach * 0.28;
        x += s.ox * straight;
        y += s.oy * straight;
        travelled += straight;
        pts.push([x, y]);
        if (g < segments - 1) {
          const diag = 10 + r() * 34;
          x += s.ox * diag + s.ax * diag * fan;
          y += s.oy * diag + s.ay * diag * fan;
          travelled += diag;
          pts.push([x, y]);
        }
      }
      const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
      traces.push({ d, end: [x, y], pulse: r() < 0.55, delay: r() * 3 });
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = r() * hgt;
    if (Math.abs(x - cx) < half * 1.6 && Math.abs(y - cy) < half * 1.6) continue;
    dots.push([x, y]);
  }
  return { traces, dots };
}

const FIELDS = new Map<string, ReturnType<typeof makeTraces>>();
function field(w: number, h: number, half: number, perSide: number) {
  const key = `${w}x${h}x${half}x${perSide}`;
  if (!FIELDS.has(key)) FIELDS.set(key, makeTraces(w, h, half, perSide, 7));
  return FIELDS.get(key)!;
}

export function CircuitField({ phase, width, height, half, perSide = 11, className }: { phase: ChipPhase; width: number; height: number; half: number; perSide?: number; className?: string }) {
  const { traces, dots } = field(width, height, half, perSide);
  const live = phase === "training" || phase === "recovering" || phase === "suspect";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cx("circuit-field", className)} data-phase={phase} aria-hidden>
      <g className="cf-dots">
        {dots.map(([x, y], i) => (
          <g key={i}>
            {[0, 1, 2].map((a) => [0, 1].map((b) => <rect key={`${a}${b}`} x={x + a * 5} y={y + b * 5} width="3" height="3" rx="0.6" />))}
          </g>
        ))}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {traces.map((t) => (
          <path key={t.d} d={t.d} className="cf-trace" />
        ))}
        {live &&
          traces.filter((t) => t.pulse).map((t) => (
            <path key={`p${t.d}`} d={t.d} pathLength={100} className="cf-pulse" style={{ animationDelay: `${-t.delay}s` }} />
          ))}
      </g>
      {traces.map((t) => (
        <circle key={`c${t.d}`} cx={t.end[0]} cy={t.end[1]} r="3.4" className="cf-pad" />
      ))}
    </svg>
  );
}

/** Chip plus its field, centred together. `size` is the chip's width in px. */
export function ChipScene({
  phase,
  util,
  vram,
  label,
  size,
  fieldWidth,
  fieldHeight,
  perSide,
  className,
  chipClassName,
}: {
  phase: ChipPhase;
  util?: number | null;
  vram?: number | null;
  label?: string;
  size: number;
  fieldWidth: number;
  fieldHeight: number;
  perSide?: number;
  className?: string;
  chipClassName?: string;
}) {
  return (
    <div className={cx("chip-scene gpu-chip relative", className)} data-phase={phase} style={{ width: size, height: size }}>
      <CircuitField
        phase={phase}
        width={fieldWidth}
        height={fieldHeight}
        half={size * 0.46}
        perSide={perSide}
        className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
      />
      <div className="chip-glow pointer-events-none absolute inset-[-30%] rounded-full" aria-hidden />
      <div className="chip-tilt relative size-full">
        <ChipArt phase={phase} util={util} vram={vram} label={label} className={cx("size-full", chipClassName)} />
      </div>
    </div>
  );
}
