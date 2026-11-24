/*
 * The hero artwork: Ekido's one idea as a picture. Devices people already have (a gaming PC, a laptop, and phones, which are
 * still being built) pass work along routes to a quality check, and what comes out is the customer's own model. It is drawn
 * in isometric projection from a few boxes, in the brand colours only (white, ink, saffron), so it stays sharp at any size
 * and costs no image download. Phones are labelled "next" because the phone app is not built yet.
 */

const A = 40; // horizontal screen step per grid unit
const B = 23; // vertical screen step per grid unit
const H = 42; // screen height of one unit of box height
const OX = 330;
const OY = 56;

const p = (x: number, y: number, z = 0): [number, number] => [OX + (x - y) * A, OY + (x + y) * B - z * H];
const pts = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

type Tone = { top: string; left: string; right: string; line?: string };
const INK: Tone = { top: "#3a4d60", left: "#0f1822", right: "#1b2937" };
const SAFFRON: Tone = { top: "#ff8a4d", left: "#d94400", right: "#fe5000" };
const PAPER: Tone = { top: "#ffffff", left: "#d9dfe5", right: "#e9edf1", line: "#c4ccd4" };

function Box({ x, y, w, d, h, z = 0, tone }: { x: number; y: number; w: number; d: number; h: number; z?: number; tone: Tone }) {
  const top = h + z;
  const stroke = tone.line ?? "none";
  return (
    <g stroke={stroke} strokeWidth={1} strokeLinejoin="round">
      <polygon points={pts([p(x, y + d, top), p(x + w, y + d, top), p(x + w, y + d, z), p(x, y + d, z)])} fill={tone.left} />
      <polygon points={pts([p(x + w, y, top), p(x + w, y + d, top), p(x + w, y + d, z), p(x + w, y, z)])} fill={tone.right} />
      <polygon points={pts([p(x, y, top), p(x + w, y, top), p(x + w, y + d, top), p(x, y + d, top)])} fill={tone.top} />
    </g>
  );
}

function Route({ points }: { points: [number, number][] }) {
  return <polyline className="hero-route" points={pts(points.map(([x, y]) => p(x, y, 0.02)))} fill="none" stroke="#fe5000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 9" />;
}

function Label({ x, y, z, dx, dy, children, anchor = "start" }: { x: number; y: number; z: number; dx: number; dy: number; children: string; anchor?: "start" | "end" | "middle" }) {
  const [sx, sy] = p(x, y, z);
  return (
    <g>
      <line x1={sx} y1={sy} x2={sx + dx} y2={sy + dy} stroke="#131e29" strokeWidth={1} opacity={0.55} />
      <circle cx={sx} cy={sy} r={2.5} fill="#131e29" />
      <text x={sx + dx + (anchor === "start" ? 6 : anchor === "end" ? -6 : 0)} y={sy + dy + 4} textAnchor={anchor} fontFamily='ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' fontSize={11} letterSpacing={1.2} fill="#131e29">
        {children}
      </text>
    </g>
  );
}

export function HeroArt({ labels }: { labels: { pc: string; laptop: string; phone: string; check: string; model: string } }) {
  const grid = [];
  for (let i = 0; i <= 9; i++) {
    grid.push(<line key={`a${i}`} x1={p(i, 0)[0]} y1={p(i, 0)[1]} x2={p(i, 9)[0]} y2={p(i, 9)[1]} />);
    grid.push(<line key={`b${i}`} x1={p(0, i)[0]} y1={p(0, i)[1]} x2={p(9, i)[0]} y2={p(9, i)[1]} />);
  }
  return (
    <svg viewBox="0 0 660 470" role="img" aria-label={labels.model} className="h-auto w-full">
      <defs>
        <linearGradient id="hero-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3ec" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <polygon points={pts([p(0, 0), p(9, 0), p(9, 9), p(0, 9)])} fill="url(#hero-floor)" />
      <g stroke="#e3e8ec" strokeWidth={1}>{grid}</g>
      <polygon points={pts([p(0, 0), p(9, 0), p(9, 9), p(0, 9)])} fill="none" stroke="#cfd6dc" strokeWidth={1.2} />

      {/* routes first, so the boxes sit on top of them */}
      <Route points={[[2.1, 1.3], [4.75, 1.3], [4.75, 3.4]]} />
      <Route points={[[4.0, 0.95], [4.0, 3.4]]} />
      <Route points={[[2.3, 4.0], [4.0, 4.0]]} />
      <Route points={[[5.4, 4.1], [7.1, 4.1], [7.1, 5.6]]} />

      {/* gaming PC */}
      <Box x={0.6} y={0.6} w={1.5} d={1.4} h={1.35} tone={INK} />
      <Box x={0.75} y={0.62} w={0.12} d={1.36} h={0.9} z={0.2} tone={SAFFRON} />
      {/* laptop: base and screen */}
      <Box x={0.6} y={3.4} w={1.7} d={1.3} h={0.2} tone={INK} />
      <Box x={0.6} y={3.4} w={0.1} d={1.3} h={1.0} z={0.2} tone={INK} />
      <Box x={0.6} y={3.5} w={0.06} d={1.1} h={0.8} z={0.28} tone={SAFFRON} />
      {/* phone, drawn lighter because it is "next" */}
      <Box x={3.6} y={0.4} w={0.7} d={0.5} h={1.5} tone={PAPER} />
      <Box x={3.62} y={0.7} w={0.66} d={0.04} h={1.3} z={0.1} tone={INK} />
      {/* quality check */}
      <Box x={4.0} y={3.4} w={1.4} d={1.4} h={0.55} tone={PAPER} />
      <polygon points={pts([p(4.3, 3.7, 0.56), p(5.1, 3.7, 0.56), p(5.1, 4.5, 0.56), p(4.3, 4.5, 0.56)])} fill="#fe5000" />
      <polyline points={pts([p(4.5, 4.1, 0.58), p(4.68, 4.3, 0.58), p(4.95, 3.8, 0.58)])} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* the customer's model */}
      <Box x={6.2} y={5.6} w={1.6} d={1.6} h={1.0} tone={SAFFRON} />
      <Box x={6.5} y={5.9} w={1.0} d={1.0} h={0.12} z={1.0} tone={PAPER} />

      <Label x={1.35} y={0.6} z={1.35} dx={-30} dy={-34} anchor="end">{labels.pc}</Label>
      <Label x={0.6} y={4.05} z={1.2} dx={-20} dy={-30} anchor="end">{labels.laptop}</Label>
      <Label x={3.95} y={0.4} z={1.5} dx={26} dy={-36}>{labels.phone}</Label>
      <Label x={5.4} y={3.6} z={0.4} dx={120} dy={-14}>{labels.check}</Label>
      <Label x={7.8} y={6.4} z={0.6} dx={56} dy={26}>{labels.model}</Label>
    </svg>
  );
}
