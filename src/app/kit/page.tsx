"use client";

import { useState } from "react";
import { Skull } from "lucide-react";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ProviderChip } from "@/components/ui/provider-chip";
import { Meter, Stat } from "@/components/ui/stat";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  SkeletonLines,
  TxStatus,
} from "@/components/ui/states";
import { StatusPill, type Tone } from "@/components/ui/status";
import { Timeline } from "@/components/ui/timeline";
import { TruthBadge, type Truth } from "@/components/ui/truth-badge";

const truths: Truth[] = ["REAL", "REAL_SEPARATE", "CAPPED_PROFILE", "INJECTED_FAULT", "RECORDED", "SAMPLE", "LOCAL_CHAIN", "SYNTHETIC"];
const tones: [Tone, string][] = [
  ["good", "Accepted"],
  ["warning", "Recovering"],
  ["serious", "Injected fault"],
  ["critical", "Rejected"],
  ["active", "Training"],
  ["neutral", "Online"],
  ["idle", "Offline"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel title={title}>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </Panel>
  );
}

export default function KitPage() {
  const [kills, setKills] = useState(0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Component kit</h1>
        <p className="mt-1 max-w-3xl text-ink-2">
          Every building block in every state. Color is reserved for meaning: status, provider identity, and caution
          badges. Status always pairs an icon with a word.
        </p>
      </div>

      <Section title="Truth badges">
        {truths.map((t) => (
          <TruthBadge key={t} truth={t} />
        ))}
      </Section>

      <Section title="Status">
        {tones.map(([t, l]) => (
          <StatusPill key={t} tone={t}>
            {l}
          </StatusPill>
        ))}
        <StatusPill tone="warning" size="lg">
          Provider A stopped responding. Recovering
        </StatusPill>
      </Section>

      <Section title="Provider identity">
        {["A", "B", "R", "C", "P"].map((id) => (
          <ProviderChip key={id} id={id} />
        ))}
        <p className="w-full text-sm text-muted">
          Fixed slot per provider id, never by rank. P (the injected-fault trainer) stays neutral so it never looks
          like a real series.
        </p>
      </Section>

      <Section title="Numbers: unit, source, and unknown">
        <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Throughput" value={1.62} digits={2} unit="steps/s" source="Measured by runtime" />
          <Stat label="GPU temperature" value={74} unit="°C" source="Host NVML" />
          <Stat label="Power" value={null} unit="W" source="Host NVML" />
          <Stat label="Recovery time" value={41.3} digits={1} unit="s" source="Sample data" size="lg" />
        </div>
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <Meter label="VRAM · Provider A" value={4810} max={6144} unit="MiB" />
          <Meter label="VRAM · Provider B (cap)" value={2860} max={3072} unit="MiB" />
          <Meter label="VRAM · Provider C" value={null} max={null} unit="MiB" />
        </div>
      </Section>

      <Section title="Buttons">
        <Button variant="primary">Submit job</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
        <ConfirmButton size="lg" onConfirm={() => setKills((k) => k + 1)} confirmLabel="Press again to kill">
          <Skull className="size-5" aria-hidden /> Kill Provider A
        </ConfirmButton>
        <p className="w-full text-sm text-muted">
          Kill needs a second press within 3 s. No browser dialog. Confirmed {kills} time{kills === 1 ? "" : "s"} here.
        </p>
      </Section>

      <Section title="Timeline">
        <div className="w-full max-w-2xl">
          <Timeline
            entries={[
              { id: "1", time: "01:25", tone: "serious", title: "Provider A stopped", detail: "Container killed from the dashboard (docker kill)" },
              { id: "2", time: "01:26", tone: "good", title: "Old worker fenced", detail: "Fencing token 1 → 2. Writes from the old worker are now rejected" },
              { id: "3", time: "01:27", tone: "good", title: "Checkpoint chosen", detail: "Step 100, accepted. 12 steps lost" },
              { id: "4", time: "01:28", tone: "active", title: "Finding a replacement" },
            ]}
          />
        </div>
      </Section>

      <Panel title="States">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState title="No providers online">Start an agent, or play the replay to see the sample network.</EmptyState>
          <div className="space-y-4">
            <LoadingState waitingFor="the first heartbeat from Provider B" />
            <SkeletonLines />
            <OfflineState since="10:02:14" />
            <ErrorState
              title="Couldn't load checkpoints"
              detail="GET /jobs/job-sample-0001/checkpoints returned 503"
              onRetry={() => {}}
            />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <TxStatus label="createJob" status="pending" hash={"0x" + "ab".repeat(32)} href="https://sepolia.basescan.org/" />
          <TxStatus label="submitAttestation" status="confirmed" hash={"0x" + "cd".repeat(32)} href="https://sepolia.basescan.org/" />
          <TxStatus label="finalize" status="failed" hash={"0x" + "ef".repeat(32)} href={null} />
        </div>
      </Panel>
    </div>
  );
}
