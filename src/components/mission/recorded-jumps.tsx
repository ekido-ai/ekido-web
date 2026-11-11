"use client";

import { useMemo } from "react";
import { CircleCheck, Coins, Skull, ShieldX } from "lucide-react";
import { usePlayer, usePlayerSnapshot } from "@/lib/events/source-context";
import { formatClock } from "@/lib/events/describe";
import { momentsOf, type MomentKind } from "@/lib/events/moments";
import { Button } from "@/components/ui/button";

const jumps: { kind: MomentKind; label: string; icon: typeof Skull }[] = [
  { kind: "lost", label: "The kill", icon: Skull },
  { kind: "refused", label: "The refusal", icon: ShieldX },
  { kind: "done", label: "Finished", icon: CircleCheck },
  { kind: "paid", label: "Payout", icon: Coins },
];

/**
 * Replay mode's answer to the Kill button. A recording can't be killed, so instead of a greyed-out
 * button these jump straight to the moments that matter. Each one works.
 */
export function RecordedJumps() {
  const player = usePlayer();
  const snap = usePlayerSnapshot();
  const moments = useMemo(() => momentsOf(player.recording.events), [player]);
  const available = jumps
    .map((j) => ({ ...j, at: moments.find((m) => m.kind === j.kind)?.offsetMs ?? null }))
    .filter((j) => j.at !== null) as ((typeof jumps)[number] & { at: number })[];

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Jump to a moment in the recording</span>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {available.map((j) => {
          const Icon = j.icon;
          const here = Math.abs(snap.positionMs - j.at) < 1500;
          return (
            <Button
              key={j.kind}
              size="sm"
              variant={here ? "primary" : "secondary"}
              onClick={() => {
                player.seek(j.at);
                if (!snap.playing) player.play();
              }}
            >
              <Icon className="size-4" aria-hidden /> {j.label} <span className="tabular font-normal opacity-70">{formatClock(j.at)}</span>
            </Button>
          );
        })}
      </div>
      <span className="max-w-80 text-xs text-muted sm:text-right">
        Kill only works in live mode. In the recording, the kill already happened. These buttons take you there.
      </span>
    </div>
  );
}
