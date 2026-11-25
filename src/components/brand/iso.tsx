import type { ReactNode } from "react";

/*
 * A tiny isometric drawing kit: boxes on a floor grid, dotted routes and labelled leader lines, in the brand colours only
 * (white, ink, saffron). Every piece of Ekido artwork (the home hero and each product page) is a scene built from these,
 * so they all look like one set. Drawn as inline SVG: sharp at any size, no image download.
 */

const A = 40; // horizontal screen step per grid unit
const B = 23; // vertical screen step per grid unit
const H = 42; // screen height of one unit of box height
const OX = 330;
const OY = 56;

export const p = (x: number, y: number, z = 0): [number, number] => [OX + (x - y) * A, OY + (x + y) * B - z * H];
const pts = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

export type Tone = { top: string; left: string; right: string; line?: string };
export const INK: Tone = { top: "#3a4d60", left: "#0f1822", right: "#1b2937" };
export const SAFFRON: Tone = { top: "#ff8a4d", left: "#d94400", right: "#fe5000" };
export const PAPER: Tone = { top: "#ffffff", left: "#d9dfe5", right: "#e9edf1", line: "#c4ccd4" };
export const FADED: Tone = { top: "#f1f3f5", left: "#dde2e7", right: "#e6eaee", line: "#d3d9de" };

export function Box({ x, y, w, d, h, z = 0, tone }: { x: number; y: number; w: number; d: number; h: number; z?: number; tone: Tone }) {
  const top = h + z;
  return (
    <g stroke={tone.line ?? "none"} strokeWidth={1} strokeLinejoin="round">
      <polygon points={pts([p(x, y + d, top), p(x + w, y + d, top), p(x + w, y + d, z), p(x, y + d, z)])} fill={tone.left} />
      <polygon points={pts([p(x + w, y, top), p(x + w, y + d, top), p(x + w, y + d, z), p(x + w, y, z)])} fill={tone.right} />
      <polygon points={pts([p(x, y, top), p(x + w, y, top), p(x + w, y + d, top), p(x, y + d, top)])} fill={tone.top} />
    </g>
  );
}

/** A flat patch on top of a box (a lit area, a screen, a tick). */
export function Patch({ x, y, w, d, z, fill }: { x: number; y: number; w: number; d: number; z: number; fill: string }) {
  return <polygon points={pts([p(x, y, z), p(x + w, y, z), p(x + w, y + d, z), p(x, y + d, z)])} fill={fill} />;
}

export function Tick({ x, y, z }: { x: number; y: number; z: number }) {
  return <polyline points={pts([p(x, y, z), p(x + 0.18, y + 0.2, z), p(x + 0.45, y - 0.3, z)])} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />;
}

export function Route({ points, solid }: { points: [number, number][]; solid?: boolean }) {
  return (
    <polyline
      className={solid ? undefined : "hero-route"}
      points={pts(points.map(([x, y]) => p(x, y, 0.02)))}
      fill="none"
      stroke="#fe5000"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={solid ? undefined : "2 9"}
    />
  );
}

export function Label({ x, y, z, dx, dy, children, anchor = "start" }: { x: number; y: number; z: number; dx: number; dy: number; children: string; anchor?: "start" | "end" | "middle" }) {
  const [sx, sy] = p(x, y, z);
  return (
    <g>
      <line x1={sx} y1={sy} x2={sx + dx} y2={sy + dy} stroke="#131e29" strokeWidth={1} opacity={0.55} />
      <circle cx={sx} cy={sy} r={2.5} fill="#131e29" />
      <text
        x={sx + dx + (anchor === "start" ? 6 : anchor === "end" ? -6 : 0)}
        y={sy + dy + 4}
        textAnchor={anchor}
        fontFamily='ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
        fontSize={11}
        letterSpacing={1.2}
        fill="#131e29"
      >
        {children}
      </text>
    </g>
  );
}

/** The floor every scene stands on: a light diamond with a grid. */
export function Floor({ size = 9 }: { size?: number }) {
  const lines: ReactNode[] = [];
  for (let i = 0; i <= size; i++) {
    lines.push(<line key={`a${i}`} x1={p(i, 0)[0]} y1={p(i, 0)[1]} x2={p(i, size)[0]} y2={p(i, size)[1]} />);
    lines.push(<line key={`b${i}`} x1={p(0, i)[0]} y1={p(0, i)[1]} x2={p(size, i)[0]} y2={p(size, i)[1]} />);
  }
  const edge = pts([p(0, 0), p(size, 0), p(size, size), p(0, size)]);
  return (
    <>
      <defs>
        <linearGradient id="iso-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3ec" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <polygon points={edge} fill="url(#iso-floor)" />
      <g stroke="#e3e8ec" strokeWidth={1}>{lines}</g>
      <polygon points={edge} fill="none" stroke="#cfd6dc" strokeWidth={1.2} />
    </>
  );
}

export function Scene({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="-90 0 840 470" role="img" aria-label={label} className="h-auto w-full">
      <Floor />
      {children}
    </svg>
  );
}

/** Reusable objects. */
export function GamingPc({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box x={x} y={y} w={1.5} d={1.4} h={1.35} tone={INK} />
      <Box x={x + 0.15} y={y + 0.02} w={0.12} d={1.36} h={0.9} z={0.2} tone={SAFFRON} />
    </>
  );
}

export function Laptop({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box x={x} y={y} w={1.7} d={1.3} h={0.2} tone={INK} />
      <Box x={x} y={y} w={0.1} d={1.3} h={1.0} z={0.2} tone={INK} />
      <Box x={x} y={y + 0.1} w={0.06} d={1.1} h={0.8} z={0.28} tone={SAFFRON} />
    </>
  );
}

export function Phone({ x, y, faded }: { x: number; y: number; faded?: boolean }) {
  return (
    <>
      <Box x={x} y={y} w={0.7} d={0.5} h={1.5} tone={faded ? PAPER : INK} />
      <Box x={x + 0.02} y={y + 0.3} w={0.66} d={0.04} h={1.3} z={0.1} tone={faded ? INK : SAFFRON} />
    </>
  );
}

export function Gate({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box x={x} y={y} w={1.4} d={1.4} h={0.55} tone={PAPER} />
      <Patch x={x + 0.3} y={y + 0.3} w={0.8} d={0.8} z={0.56} fill="#fe5000" />
      <Tick x={x + 0.5} y={y + 0.7} z={0.58} />
    </>
  );
}

export function ModelBox({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Box x={x} y={y} w={1.6} d={1.6} h={1.0} tone={SAFFRON} />
      <Box x={x + 0.3} y={y + 0.3} w={1.0} d={1.0} h={0.12} z={1.0} tone={PAPER} />
    </>
  );
}

/** A server rack: stacked slabs with a lit strip each. */
export function Rack({ x, y, slabs = 3 }: { x: number; y: number; slabs?: number }) {
  return (
    <>
      {Array.from({ length: slabs }, (_, i) => (
        <g key={i}>
          <Box x={x} y={y} w={1.5} d={1.3} h={0.42} z={i * 0.46} tone={INK} />
          <Box x={x + 1.1} y={y + 1.3 - 0.01} w={0.3} d={0.04} h={0.08} z={i * 0.46 + 0.17} tone={SAFFRON} />
        </g>
      ))}
    </>
  );
}
