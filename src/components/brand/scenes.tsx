import { Box, FADED, Gate, GamingPc, INK, Label, Laptop, ModelBox, PAPER, Patch, Phone, Rack, Route, SAFFRON, Scene } from "@/components/brand/iso";

/*
 * One isometric scene per part of the service, built from the same pieces as the home hero. Each takes its labels as an
 * array (from messages/<locale>.json, "art.scenes"), in the order the labels appear below.
 */

type Props = { labels: string[]; title: string };

/** A paper slab with ruled text lines: a job description, a quote. */
function Sheet({ x, y, w = 1.8, d = 1.2, bar }: { x: number; y: number; w?: number; d?: number; bar?: boolean }) {
  return (
    <>
      <Box x={x} y={y} w={w} d={d} h={0.22} tone={PAPER} />
      <Patch x={x + 0.22} y={y + 0.2} w={w - 0.6} d={0.09} z={0.23} fill="#131e29" />
      <Patch x={x + 0.22} y={y + 0.45} w={w - 0.9} d={0.09} z={0.23} fill="#9aa7b3" />
      <Patch x={x + 0.22} y={y + 0.7} w={w - 0.75} d={0.09} z={0.23} fill="#9aa7b3" />
      {bar && <Patch x={x + 0.22} y={y + d - 0.34} w={w - 1.1} d={0.16} z={0.23} fill="#fe5000" />}
    </>
  );
}

export function AssistantScene({ labels, title }: Props) {
  return (
    <Scene label={title}>
      <Route points={[[2.7, 1.8], [4.6, 1.8], [4.6, 2.9]]} />
      <Route points={[[5.3, 3.7], [7.4, 3.7], [7.4, 5.3]]} />
      <Sheet x={0.9} y={1.2} />
      <Box x={3.9} y={2.9} w={1.4} d={1.4} h={0.8} tone={SAFFRON} />
      <Box x={4.2} y={3.2} w={0.8} d={0.8} h={0.1} z={0.8} tone={PAPER} />
      <Sheet x={6.5} y={5.3} bar />
      <Label x={1.5} y={1.2} z={0.22} dx={-24} dy={-34} anchor="end">{labels[0]}</Label>
      <Label x={4.6} y={2.9} z={0.8} dx={46} dy={-40}>{labels[1]}</Label>
      <Label x={8.3} y={6.0} z={0.22} dx={20} dy={-34} anchor="end">{labels[2]}</Label>
    </Scene>
  );
}

export function TrainScene({ labels, title }: Props) {
  return (
    <Scene label={title}>
      <Route points={[[2.1, 1.5], [3.0, 1.4]]} />
      <Route points={[[3.3, 1.7], [3.3, 4.7]]} />
      <Route points={[[5.1, 4.9], [6.0, 4.9]]} />
      <Route points={[[6.6, 4.8], [7.1, 4.8], [7.1, 6.0]]} />
      <GamingPc x={0.6} y={0.8} />
      <Box x={3.0} y={1.1} w={0.6} d={0.6} h={0.35} tone={SAFFRON} />
      <Laptop x={3.4} y={4.2} />
      <Box x={6.0} y={4.5} w={0.6} d={0.6} h={0.35} tone={SAFFRON} />
      <Phone x={6.8} y={6.0} faded />
      <Label x={1.35} y={0.8} z={1.35} dx={-30} dy={-34} anchor="end">{labels[0]}</Label>
      <Label x={3.6} y={1.1} z={0.35} dx={40} dy={-30}>{labels[1]}</Label>
      <Label x={3.4} y={5.5} z={0.2} dx={-30} dy={30} anchor="end">{labels[2]}</Label>
      <Label x={7.5} y={6.0} z={1.5} dx={40} dy={-30}>{labels[3]}</Label>
    </Scene>
  );
}

export function VerifyScene({ labels, title }: Props) {
  return (
    <Scene label={title}>
      <Route points={[[2.4, 1.7], [5.0, 1.7], [5.0, 2.6]]} />
      <Route points={[[2.3, 4.6], [4.2, 4.6]]} />
      <Route points={[[5.6, 3.4], [7.3, 3.4], [7.3, 5.2]]} />
      <Box x={0.9} y={1.0} w={1.4} d={1.4} h={0.55} tone={FADED} />
      <Box x={0.9} y={3.9} w={1.4} d={1.4} h={0.9} tone={SAFFRON} />
      <Gate x={4.2} y={2.6} />
      <Sheet x={6.5} y={5.2} bar />
      <Label x={0.9} y={1.0} z={0.55} dx={-26} dy={-30} anchor="end">{labels[0]}</Label>
      <Label x={0.9} y={5.3} z={0.9} dx={-26} dy={30} anchor="end">{labels[1]}</Label>
      <Label x={5.6} y={2.6} z={0.55} dx={36} dy={-34}>{labels[2]}</Label>
      <Label x={8.3} y={6.0} z={0.22} dx={30} dy={30}>{labels[3]}</Label>
    </Scene>
  );
}

export function HostScene({ labels, title }: Props) {
  return (
    <Scene label={title}>
      <Route points={[[2.6, 1.8], [5.4, 1.8]]} />
      <Route points={[[1.8, 2.5], [1.8, 5.6], [3.6, 5.6]]} />
      <Route points={[[5.2, 5.6], [6.9, 5.6]]} />
      <Rack x={1.0} y={0.9} slabs={3} />
      <Laptop x={5.4} y={1.1} />
      <Sheet x={3.6} y={5.0} w={1.6} d={1.1} bar />
      <Phone x={6.9} y={5.2} faded />
      <Label x={1.6} y={0.9} z={1.4} dx={-26} dy={-34} anchor="end">{labels[0]}</Label>
      <Label x={7.1} y={1.1} z={1.2} dx={36} dy={-30}>{labels[1]}</Label>
      <Label x={3.6} y={6.1} z={0.22} dx={-30} dy={34} anchor="end">{labels[2]}</Label>
      <Label x={7.6} y={5.2} z={1.5} dx={40} dy={-30}>{labels[3]}</Label>
    </Scene>
  );
}

export function PayScene({ labels, title }: Props) {
  return (
    <Scene label={title}>
      <Route points={[[3.6, 4.0], [1.9, 4.0], [1.9, 2.4]]} />
      <Route points={[[5.4, 4.5], [7.2, 4.5], [7.2, 2.6]]} />
      <Route points={[[4.5, 5.4], [4.5, 7.0], [3.2, 7.0]]} solid />
      <Box x={1.0} y={0.9} w={1.4} d={1.4} h={0.8} tone={INK} />
      <Box x={6.6} y={1.0} w={1.4} d={1.4} h={0.8} tone={INK} />
      <Box x={3.6} y={3.6} w={1.8} d={1.8} h={0.6} tone={PAPER} />
      <Patch x={3.9} y={3.9} w={1.2} d={1.2} z={0.61} fill="#fe5000" />
      <Box x={0.9} y={6.1} w={1.4} d={1.4} h={0.55} tone={FADED} />
      <Label x={1.7} y={0.9} z={0.8} dx={-26} dy={-34} anchor="end">{labels[0]}</Label>
      <Label x={7.3} y={1.0} z={0.8} dx={36} dy={-30}>{labels[1]}</Label>
      <Label x={4.5} y={3.6} z={0.6} dx={-20} dy={-60} anchor="end">{labels[2]}</Label>
      <Label x={0.9} y={7.0} z={0.55} dx={-26} dy={30} anchor="end">{labels[3]}</Label>
    </Scene>
  );
}

export function DevicesScene({ labels, title }: Props) {
  return (
    <Scene label={title}>
      <Route points={[[2.1, 1.3], [4.6, 1.3], [4.6, 3.6]]} />
      <Route points={[[2.3, 4.0], [4.4, 4.0]]} />
      <Route points={[[4.0, 0.95], [4.0, 3.6]]} />
      <GamingPc x={0.6} y={0.6} />
      <Laptop x={0.6} y={3.4} />
      <Phone x={3.6} y={0.4} faded />
      <Box x={4.4} y={3.6} w={2.0} d={1.6} h={0.7} tone={INK} />
      <Patch x={4.7} y={3.9} w={1.4} d={1.0} z={0.71} fill="#fe5000" />
      <ModelBox x={6.9} y={6.1} />
      <Label x={1.35} y={0.6} z={1.35} dx={-30} dy={-34} anchor="end">{labels[0]}</Label>
      <Label x={0.6} y={4.05} z={1.2} dx={-20} dy={-30} anchor="end">{labels[1]}</Label>
      <Label x={3.95} y={0.4} z={1.5} dx={26} dy={-36}>{labels[2]}</Label>
      <Label x={6.4} y={4.4} z={0.5} dx={90} dy={-14}>{labels[3]}</Label>
    </Scene>
  );
}

const SCENES = { assistant: AssistantScene, train: TrainScene, verify: VerifyScene, host: HostScene, pay: PayScene, devices: DevicesScene } as const;

export function ProductScene({ name, labels, title }: { name: string } & Props) {
  const Scene = SCENES[name as keyof typeof SCENES];
  return Scene ? <Scene labels={labels} title={title} /> : null;
}
