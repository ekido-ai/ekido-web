"use client";

import { useState } from "react";
import { Skull } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { PlatformKit } from "@/components/platform/kit-samples";
import { TruthBadge, type Truth } from "@/components/ui/truth-badge";

const truths: Truth[] = ["REAL", "REAL_SEPARATE", "CAPPED_PROFILE", "INJECTED_FAULT", "RECORDED", "SAMPLE", "LOCAL_CHAIN", "SYNTHETIC"];
// Each tone's sample word is in messages (kit.tones.<tone>).
const tones: Tone[] = ["good", "warning", "serious", "critical", "active", "neutral", "idle"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel title={title}>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </Panel>
  );
}

export default function KitPage() {
  const t = useTranslations("kit");
  const [kills, setKills] = useState(0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 max-w-3xl text-ink-2">
          {t("lead")}
        </p>
      </div>

      <Section title={t("truthBadges")}>
        {truths.map((truth) => (
          <TruthBadge key={truth} truth={truth} />
        ))}
      </Section>

      <Section title={t("status")}>
        {tones.map((tone) => (
          <StatusPill key={tone} tone={tone}>
            {t(`tones.${tone}`)}
          </StatusPill>
        ))}
        <StatusPill tone="warning" size="lg">
          {t("statusLong")}
        </StatusPill>
      </Section>

      <Section title={t("identity")}>
        {["A", "B", "R", "C", "P"].map((id) => (
          <ProviderChip key={id} id={id} />
        ))}
        <p className="w-full text-sm text-muted">
          {t("identityNote")}
        </p>
      </Section>

      <Section title={t("numbers")}>
        <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label={t("throughput")} value={1.62} digits={2} unit={t("stepsPerS")} source={t("measuredRuntime")} />
          <Stat label={t("gpuTemp")} value={74} unit="°C" source={t("hostNvml")} />
          <Stat label={t("power")} value={null} unit="W" source={t("hostNvml")} />
          <Stat label={t("recoveryTime")} value={41.3} digits={1} unit="s" source={t("sampleData")} size="lg" />
        </div>
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <Meter label={t("vram", { id: "A" })} value={4810} max={6144} unit="MiB" />
          <Meter label={t("vramCap", { id: "B" })} value={2860} max={3072} unit="MiB" />
          <Meter label={t("vram", { id: "C" })} value={null} max={null} unit="MiB" />
        </div>
      </Section>

      <Section title={t("buttons")}>
        <Button variant="primary">{t("submitJob")}</Button>
        <Button>{t("secondary")}</Button>
        <Button variant="ghost">{t("ghost")}</Button>
        <Button disabled>{t("disabled")}</Button>
        <ConfirmButton size="lg" onConfirm={() => setKills((k) => k + 1)} confirmLabel={t("pressToKill")}>
          <Skull className="size-5" aria-hidden /> {t("kill")}
        </ConfirmButton>
        <p className="w-full text-sm text-muted">
          {t("killNote", { n: kills })}
        </p>
      </Section>

      <Section title={t("timeline")}>
        <div className="w-full max-w-2xl">
          <Timeline
            entries={[
              { id: "1", time: "01:25", tone: "serious", title: t("tl.stoppedTitle"), detail: t("tl.stoppedDetail") },
              { id: "2", time: "01:26", tone: "good", title: t("tl.fencedTitle"), detail: t("tl.fencedDetail") },
              { id: "3", time: "01:27", tone: "good", title: t("tl.chosenTitle"), detail: t("tl.chosenDetail") },
              { id: "4", time: "01:28", tone: "active", title: t("tl.replacing") },
            ]}
          />
        </div>
      </Section>

      <Panel title={t("states")}>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState title={t("noProvidersTitle")}>{t("noProviders")}</EmptyState>
          <div className="space-y-4">
            <LoadingState waitingFor={t("heartbeat")} />
            <SkeletonLines />
            <OfflineState since="10:02:14" />
            <ErrorState
              title={t("checkpointsError")}
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

      {/* P4: the platform components, every state (ekido-ai/ekido-internal#45). */}
      <PlatformKit />
    </div>
  );
}
