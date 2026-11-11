import { cx } from "@/components/ui/cx";

export type ChipPhase = "idle" | "training" | "suspect" | "off" | "recovering";

/** 30 streaming multiprocessors, as on the RTX 3060 Laptop GPU we run on. */
const COLS = 6;
const ROWS = 5;
const SMS = COLS * ROWS;
/** Six 1 GB memory modules around the die: 6 GB, like the real card. */
const VRAM = [
  [22, 50], [22, 87], [22, 124],
  [156, 50], [156, 87], [156, 124],
] as const;

/** Stable pseudo-random per core, so the same cores light first on every render. */
const rank = Array.from({ length: SMS }, (_, i) => ({ i, r: Math.sin(i * 12.9898 + 78.233) * 43758.5453 % 1 }))
  .sort((a, b) => Math.abs(a.r) - Math.abs(b.r))
  .map((x) => x.i);
const order = new Map(rank.map((i, k) => [i, k]));

const PINS = Array.from({ length: 19 }, (_, k) => 24 + k * 8);
const TRACES = [
  "M56 70 H40 V40 H14", "M56 100 H46", "M56 130 H40 V160 H14",
  "M144 70 H160 V40 H186", "M144 100 H154", "M144 130 H160 V160 H186",
  "M80 56 V30 H60 V14", "M120 56 V30 H140 V14", "M100 56 V14",
  "M80 144 V170 H60 V186", "M120 144 V170 H140 V186", "M100 144 V186",
];

/**
 * A GPU package drawn from data: lit cores follow utilization, lit memory modules follow VRAM use,
 * and the glow follows temperature. Purely decorative; the numbers are always printed next to it.
 */
export function GpuChip({
  phase,
  util = null,
  vram = null,
  temp = null,
  className,
  overclock = false,
}: {
  phase: ChipPhase;
  /** 0..1 */
  util?: number | null;
  /** 0..1 of total memory */
  vram?: number | null;
  temp?: number | null;
  className?: string;
  overclock?: boolean;
}) {
  const busy = phase === "training" || phase === "suspect";
  const u = phase === "training" ? (util ?? 0.85) : phase === "suspect" ? 0.35 : phase === "recovering" ? 1 : phase === "idle" ? 0.08 : 0;
  const lit = Math.round(u * SMS);
  const mods = phase === "off" ? 0 : Math.round((vram ?? (busy ? 0.5 : 0.1)) * VRAM.length);
  const heat = phase === "off" ? 0 : temp === null ? (busy ? 0.6 : 0.15) : Math.min(1, Math.max(0, (temp - 40) / 50));

  return (
    <div className={cx("gpu-chip relative", className)} data-phase={phase} data-oc={overclock ? "on" : undefined}>
      <div
        aria-hidden
        className="gpu-heat pointer-events-none absolute inset-[-18%] rounded-full transition-opacity duration-700"
        style={{ opacity: heat }}
      />
      <svg viewBox="0 0 200 200" className="relative block size-full" aria-hidden>
        <defs>
          <linearGradient id="gpu-die" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1c1c1c" />
            <stop offset="1" stopColor="#0b0b0b" />
          </linearGradient>
          <linearGradient id="gpu-sub" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#121212" />
            <stop offset="1" stopColor="#070707" />
          </linearGradient>
        </defs>

        {/* Substrate and its edge pins. */}
        <rect x="10" y="10" width="180" height="180" rx="14" fill="url(#gpu-sub)" stroke="#2e3033" />
        {PINS.map((p) => (
          <g key={p} className="gpu-pin">
            <rect x={p - 1.5} y="4" width="3" height="7" rx="1" />
            <rect x={p - 1.5} y="189" width="3" height="7" rx="1" />
            <rect x="4" y={p - 1.5} width="7" height="3" rx="1" />
            <rect x="189" y={p - 1.5} width="7" height="3" rx="1" />
          </g>
        ))}

        {/* Copper traces; while training, data runs along them. */}
        <g fill="none" strokeWidth="1.4" strokeLinecap="round">
          {TRACES.map((d) => <path key={d} d={d} stroke="#262626" />)}
          {busy && TRACES.map((d, i) => <path key={`f${d}`} d={d} className="gpu-flow" style={{ animationDelay: `${(i % 6) * -0.35}s` }} />)}
        </g>

        {/* Memory modules. */}
        {VRAM.map(([x, y], i) => (
          <g key={`${x}-${y}`} className={cx("gpu-mem", i < mods && "is-on")}>
            <rect x={x} y={y} width="22" height="26" rx="2.5" />
            <rect x={x + 4} y={y + 5} width="14" height="2" rx="1" className="gpu-mem-line" />
          </g>
        ))}

        {/* The die: 30 cores. */}
        <rect x="56" y="56" width="88" height="88" rx="5" fill="url(#gpu-die)" stroke="#3a3c40" className="gpu-die" />
        {Array.from({ length: SMS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const on = (order.get(i) ?? 0) < lit;
          return (
            <rect
              key={i}
              x={62 + c * 13}
              y={66 + r * 14}
              width="11"
              height="12"
              rx="1.5"
              className={cx("gpu-sm", on && "is-on")}
              style={{ ["--d" as string]: `${((order.get(i) ?? 0) * 0.137) % 1.3}s`, ["--b" as string]: `${i * 28}ms` }}
            />
          );
        })}
      </svg>
    </div>
  );
}
