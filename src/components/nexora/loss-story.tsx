"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import type { Segment } from "@/lib/landing/run-story";

/*
 * The real training loss from the 4 Nov run, drawn stretch by stretch as it scrolls
 * into view, with notes in plain words. Hover anywhere for the exact step and loss.
 */

const W = 1000;
const PAD = { l: 44, r: 20, t: 24, b: 36 };
// Phones get a taller chart with bigger type (the SVG is scaled down ~3x) and the notes as a list below.
const COMPACT = "(max-width: 639px)";
const PAD_C = { l: 78, r: 24, t: 48, b: 64 };
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(COMPACT);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const MAX_LOSS = 1.6;
const STEPS = 400;
const DRAW_MS = 1500;

const look: Record<string, { color: string; dash?: string; label: string }> = {
  "Provider A": { color: "#2a78d6", label: "Provider A" },
  "Provider P": { color: "#8b9099", dash: "6 6", label: "Provider P (fault injected)" },
  "Provider B": { color: "#eb6834", label: "Provider B" },
};


export function LossStory({ segments }: { segments: Segment[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0); // 0 = not drawn yet; bumps to replay
  const [hover, setHover] = useState<{ step: number; loss: number; provider: string } | null>(null);
  const compact = useSyncExternalStore(subscribe, () => window.matchMedia(COMPACT).matches, () => false);
  const H = compact ? 720 : 360;
  const pad = compact ? PAD_C : PAD;
  const fs = compact ? 2.6 : 1; // type and stroke scale
  const x = (step: number) => pad.l + (step / STEPS) * (W - pad.l - pad.r);
  const y = (loss: number) => pad.t + (1 - Math.min(loss, MAX_LOSS) / MAX_LOSS) * (H - pad.t - pad.b);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRun((r) => (r === 0 ? 1 : r));
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const paths = useMemo(
    () => segments.map((s) => ({ ...s, d: s.points.map(([st, l], i) => `${i ? "L" : "M"}${x(st).toFixed(1)},${y(l).toFixed(1)}`).join("") })),
    // x and y only change with `compact`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, compact],
  );

  const end = (name: string) => segments.find((s) => s.provider === name)?.points.at(-1);
  const peakP = segments.find((s) => s.provider === "Provider P")?.points.reduce((a, b) => (b[1] > a[1] ? b : a));
  const aEnd = end("Provider A");
  const bEnd = end("Provider B");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const step = Math.round(((((e.clientX - r.left) / r.width) * W - pad.l) / (W - pad.l - pad.r)) * STEPS);
    if (step < 0 || step > STEPS) return setHover(null);
    // Prefer the stretch that ended up counting (the last one covering this step).
    let best: { step: number; loss: number; provider: string } | null = null;
    for (const s of segments) {
      const [first, last] = [s.points[0][0], s.points.at(-1)![0]];
      if (step < first || step > last) continue;
      const p = s.points.reduce((a, b) => (Math.abs(b[0] - step) < Math.abs(a[0] - step) ? b : a));
      best = { step: p[0], loss: p[1], provider: s.provider };
    }
    setHover(best);
  };

  const shown = run > 0;
  const delay = (i: number) => `${i * DRAW_MS}ms`;

  return (
    <div ref={box} className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--n-ink-2)]">
        {segments.map((s) => (
          <span key={s.provider} className="flex items-center gap-2">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" y1="3" x2="22" y2="3" stroke={look[s.provider]?.color} strokeWidth="2.5" strokeDasharray={look[s.provider]?.dash} />
            </svg>
            {look[s.provider]?.label ?? s.provider}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="press ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--n-line-2)] px-3 py-1.5 text-sm font-medium text-[var(--n-ink)] hover:bg-white/5"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Replay
        </button>
      </div>

      <svg
        key={run}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none overflow-visible"
        role="img"
        aria-label="Training loss by step on 4 Nov. Provider A trains to step 158 and is killed. Provider P resumes from step 150 but its loss climbs to about 1.4 and its checkpoint is refused. Provider B resumes from step 150 and finishes at step 400."
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.4, 0.8, 1.2, 1.6].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--n-line)" strokeWidth={fs} />
            <text x={pad.l - 10 * fs} y={y(v) + 4 * fs} textAnchor="end" fontSize={12 * fs} fill="var(--n-slate)">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {[0, 100, 200, 300, 400].map((s) => (
          <text key={s} x={x(s)} y={H - 10 * fs} textAnchor="middle" fontSize={12 * fs} fill="var(--n-slate)">
            {s}
          </text>
        ))}
        {!compact && (
          <text x={W - pad.r} y={H - 10} textAnchor="end" fontSize="12" fill="var(--n-slate)" dx="-40">
            step →
          </text>
        )}

        {/* Both restarts begin from the accepted step-150 checkpoint. */}
        <g className="transition-opacity duration-700" style={{ opacity: shown ? 1 : 0, transitionDelay: delay(1) }}>
          <line x1={x(150)} x2={x(150)} y1={pad.t} y2={H - pad.b} stroke="#22c55e" strokeWidth={fs} strokeDasharray={`${3 * fs} ${4 * fs}`} />
          <text x={x(150) - 8 * fs} y={pad.t + 10 * fs} fontSize={12 * fs} fill="#4ade80" textAnchor="end">
            {compact ? "last good checkpoint →" : "both restarts begin at the last good checkpoint (step 150) →"}
          </text>
        </g>

        {paths.map((p, i) => {
          const st = look[p.provider];
          return (
            <path
              key={p.provider}
              d={p.d}
              fill="none"
              stroke={st?.color}
              strokeWidth={(p.provider === "Provider P" ? 2 : 2.5) * (compact ? 1.8 : 1)}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: shown ? 0 : 1,
                transition: `stroke-dashoffset ${DRAW_MS}ms ease-in-out ${delay(i)}`,
                opacity: p.provider === "Provider P" ? 0.9 : 1,
              }}
            />
          );
        })}

        {/* Dashes for P go on after its line is drawn (dasharray is used by the draw). */}
        {paths
          .filter((p) => look[p.provider]?.dash)
          .map((p) => (
            <path key={`${p.provider}-mask`} d={p.d} fill="none" stroke="var(--n-paper)" strokeWidth={compact ? 6 : 3} strokeDasharray={compact ? "12 12" : "6 6"} strokeDashoffset={compact ? 12 : 6} className="transition-opacity duration-300" style={{ opacity: shown ? 1 : 0, transitionDelay: `${2 * DRAW_MS}ms` }} />
          ))}

        {aEnd && (
          <Note n={compact ? 1 : 0} x={x(aEnd[0])} y={y(aEnd[1])} dx={-40} dy={-150} show={shown} at={DRAW_MS} color="#dc2626" title="We pulled the plug here" body={`Provider A, step ${aEnd[0]}. Noticed in 0.6 s.`} />
        )}
        {peakP && (
          <Note n={compact ? 2 : 0} x={x(peakP[0])} y={y(peakP[1])} dx={60} dy={70} show={shown} at={2 * DRAW_MS} color="#dc2626" title="Provider P sent junk" body="Loss shot up. Both verifiers said no, so it earned nothing." />
        )}
        {bEnd && (
          <Note n={compact ? 3 : 0} x={x(bEnd[0])} y={y(bEnd[1])} dx={-250} dy={-70} show={shown} at={3 * DRAW_MS} color="#16a34a" title="Finished on Provider B" body="Final accuracy 90.7%, checked by both verifiers." />
        )}

        {hover && (
          <g pointerEvents="none">
            <line x1={x(hover.step)} x2={x(hover.step)} y1={pad.t} y2={H - pad.b} stroke="var(--n-ink)" strokeOpacity="0.25" strokeWidth={fs} />
            <circle cx={x(hover.step)} cy={y(hover.loss)} r={5 * fs} fill="var(--n-paper)" stroke={look[hover.provider]?.color} strokeWidth={2.5 * fs} />
          </g>
        )}
      </svg>

      {compact && (
        <ol className="mt-4 space-y-3 text-sm">
          {[
            { c: "#dc2626", t: "We pulled the plug here", b: `Provider A, step ${aEnd?.[0]}. Noticed in 0.6 s.` },
            { c: "#dc2626", t: "Provider P sent junk", b: "Loss shot up. Both verifiers said no, so it earned nothing." },
            { c: "#16a34a", t: "Finished on Provider B", b: "Final accuracy 90.7%, checked by both verifiers." },
          ].map((n, i) => (
            <li key={n.t} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: n.c }}>
                {i + 1}
              </span>
              <span>
                <b className="font-semibold">{n.t}.</b> <span className="text-[var(--n-ink-2)]">{n.b}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[var(--n-line-2)] bg-[var(--n-card)] px-3 py-2 text-sm shadow-lg"
          style={{ left: `${(x(hover.step) / W) * 100}%`, top: 40, transform: `translateX(${hover.step > 300 ? "-110%" : "12px"})` }}
        >
          <p className="font-medium">{look[hover.provider]?.label}</p>
          <p className="font-mono text-xs text-[var(--n-slate)]">
            step {hover.step} · loss {hover.loss.toFixed(3)}
          </p>
        </div>
      )}
    </div>
  );
}

function Note({ n, x: px, y: py, dx, dy, show, at, color, title, body }: { n: number; x: number; y: number; dx: number; dy: number; show: boolean; at: number; color: string; title: string; body: string }) {
  const tx = px + dx;
  const ty = py + dy;
  // Phones: just a numbered dot; the words go in the list under the chart.
  if (n) {
    return (
      <g className="transition-opacity duration-500" style={{ opacity: show ? 1 : 0, transitionDelay: `${at}ms` }}>
        <circle cx={px} cy={py} r="22" fill="none" stroke={color} className="note-ping" />
        <circle cx={px} cy={py} r="22" fill={color} stroke="var(--n-paper)" strokeWidth="5" />
        <text x={px} y={py + 9} textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff">
          {n}
        </text>
      </g>
    );
  }
  return (
    <g className="transition-[opacity,transform] duration-500" style={{ opacity: show ? 1 : 0, transitionDelay: `${at}ms` }}>
      <circle cx={px} cy={py} r="5" fill={color} />
      <circle cx={px} cy={py} r="5" fill="none" stroke={color} className="note-ping" />
      <path d={`M${px},${py} Q${px + dx * 0.2},${ty} ${tx},${ty}`} fill="none" stroke={color} strokeOpacity="0.5" />
      <text x={tx + (dx < 0 ? -6 : 6)} y={ty - 4} fontSize="14" fontWeight="600" fill="var(--n-ink)" textAnchor={dx < 0 ? "end" : "start"}>
        {title}
      </text>
      <text x={tx + (dx < 0 ? -6 : 6)} y={ty + 14} fontSize="12.5" fill="var(--n-ink-2)" textAnchor={dx < 0 ? "end" : "start"}>
        {body}
      </text>
    </g>
  );
}
