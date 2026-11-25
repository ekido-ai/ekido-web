"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDashboard } from "@/lib/events/source-context";
import { buttonStyles } from "@/components/ui/button-styles";
import { describeStage } from "@/lib/events/describe";
import { providerName, rejectedProviders, resumePoint } from "@/lib/events/derive";
import { settlementView } from "@/lib/events/views";
import { PayoutStrip } from "@/components/mission/payout-strip";
import { StartDemoJob } from "@/components/mission/start-demo-job";
import { DownloadModel } from "@/components/mission/download-model";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { StatusPill } from "@/components/ui/status";
import { TxStatus } from "@/components/ui/states";
import { LossChart } from "@/components/mission/loss-chart";
import { ProviderGrid } from "@/components/mission/provider-grid";
import { RecoveryTimeline } from "@/components/mission/recovery-timeline";
import { KillControl } from "@/components/mission/kill-control";
import { LoadingState } from "@/components/ui/states";
import { JourneyStrip } from "@/components/mission/journey-strip";
import { LiveGpu } from "@/components/mission/live-gpu";
import { CoordinatorOffline } from "@/components/shell/coordinator-offline";
import { config } from "@/lib/config";

// Labels are in messages (demo.dashboard.tx.<kind>); an unknown kind shows as itself.
const TX_KINDS = new Set(["createJob", "markActive", "anchorEvent", "submitAttestation", "finalize", "withdraw"]);

// Every screen has one top-level heading (ekido-internal#92). Mission control's visible headline is the live status,
// so the page title is kept for screen readers and the outline.
export default function MissionControlPage() {
  const t = useTranslations("demo.dashboard");
  return (
    <>
      <h1 className="sr-only">{t("title")}</h1>
      <MissionControl />
    </>
  );
}

function MissionControl() {
  const t = useTranslations("demo.dashboard");
  const [showTable, setShowTable] = useState(false);
  const { state, mode, provenance, live: liveSnap } = useDashboard();
  const fresh = describeStage(state);
  // Live but disconnected: what we show is the last thing we heard, not what is happening.
  const stale = mode === "live" && liveSnap.connection !== "live";
  const signedJobs = config.signedJobs && config.chainId === 84532;
  const stage =
    stale && state.log.length > 0
      ? { ...fresh, tone: "idle" as const, headline: t("lastKnown", { headline: fresh.headline }) }
      : mode === "live" && state.jobState === null
        ? { ...fresh, detail: t(signedJobs ? "waitingSigned" : "waitingDemo") }
        : fresh;
  const last = state.progress.at(-1);
  const total = last?.total_steps ?? null;
  // During a recovery the job really stands at the checkpoint it resumes from, not the last step reported.
  const resume = resumePoint(state);
  const shownStep = resume ?? last?.step ?? 0;
  const frac = last && total ? shownStep / total : 0;
  // A rejected provider's loss can look great. It shouldn't be the number people read.
  const refused = rejectedProviders(state);
  const lastTrusted = [...state.progress].reverse().find((p) => !refused.has(p.provider_id));
  const settled = settlementView(state) !== null;
  // Nothing is running, so the useful button is the one that starts something.
  const canStart = state.jobState === null || ["SETTLED", "REFUNDED", "FAILED", "CANCELLED"].includes(state.jobState);
  const lastTx = state.chain.at(-1);
  // Only name a provider as "training" while the job is actually running.
  const running = state.jobState === "RUNNING" && !stale;
  const live = running ? state.activeProviderId : null;

  // Live mode with nothing received yet: say what we're waiting for instead of empty panels.
  if (mode === "live" && state.log.length === 0) {
    if (liveSnap.connection === "offline" || liveSnap.connection === "reconnecting") return <CoordinatorOffline />;
    if (liveSnap.connection === "live" && canStart)
      return (
        <section className="mx-auto max-w-3xl panel rounded-2xl border border-line p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t("noJobTitle")}</h1>
          <p className="mt-2 text-ink-2">
            {t(signedJobs ? "noJobSigned" : "noJobDemo")}
          </p>
          <div className="mt-6">
            {signedJobs
              ? <Link href="/jobs/new" className={buttonStyles("primary", "md")}>{t("newSignedJob")}</Link>
              : <StartDemoJob jobState={state.jobState} align="start" />}
          </div>
        </section>
      );
    return (
      <LoadingState waitingFor={t(liveSnap.connection === "live" ? "waitingFirstEvent" : "waitingConnection")} />
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. What is happening, in plain words, beside the GPU doing it. Readable from across the room. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="min-w-0 panel rounded-2xl border border-line px-4 py-4 sm:px-6" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* A 16rem basis, so on phones the hint or buttons wrap below instead of squeezing the headline
              into one word per line (ekido-ai/ekido-core#130). */}
          <div className="min-w-0 flex-[1_1_16rem]">
            <StatusPill tone={stage.tone} size="lg">
              <span className="text-xl sm:text-2xl">{stage.headline}</span>
            </StatusPill>
            {stage.detail && <p className="mt-2 text-lg text-ink-2">{stage.detail}</p>}
          </div>
          {mode === "replay" ? (
            <p className="max-w-72 text-sm text-ink-2 sm:text-right">
              {t("recordingHint")}
            </p>
          ) : signedJobs ? (
            !stale && canStart && <Link href="/jobs/new" className={buttonStyles("primary", "md")}>{t("newSignedJob")}</Link>
          ) : !stale && canStart ? (
            <div className="flex flex-wrap items-center gap-3">
              <DownloadModel jobId={state.jobId} jobState={state.jobState} live={mode === "live"} />
              <StartDemoJob jobState={state.jobState} />
            </div>
          ) : (
            <KillControl state={state} mode={mode} provenance={provenance} connected={!stale} />
          )}
        </div>

        <div className="mt-4">
          <JourneyStrip state={state} replay={mode === "replay"} stale={stale} />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div
            className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-label={t("progressAria")}
            aria-valuemin={0}
            aria-valuemax={total ?? undefined}
            aria-valuenow={shownStep}
          >
            <div className="h-full rounded-full bg-ink-2 transition-[width] duration-700" style={{ width: `${frac * 100}%` }} />
          </div>
          <span className="tabular shrink-0 text-sm text-ink">
            {!last ? (
              <span className="italic text-muted">{t("notStarted")}</span>
            ) : resume !== null ? (
              t("goingBack", { step: resume, total: total ?? 0 })
            ) : (
              t("step", { step: last.step, total: total ?? 0 })
            )}
          </span>
        </div>

        {settled ? (
          <PayoutStrip state={state} />
        ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
          <Stat
            label={t("trainingOn")}
            value={live ? providerName(state, live) : stale ? null : last ? t("nobody") : null}
          />
          <Stat
            label={t("throughput")}
            value={running ? (last?.steps_per_s ?? null) : null}
            digits={1}
            unit={t("stepsPerS")}
            source={t(running ? "runtime" : "notTraining")}
          />
          <Stat
            label={t(running ? "loss" : "lastTrustedLoss")}
            value={lastTrusted?.loss ?? null}
            digits={3}
            source={lastTrusted ? t("runtimeOf", { provider: providerName(state, lastTrusted.provider_id) }) : undefined}
          />
          <Stat
            label={t("generation")}
            value={state.fencingToken || null}
            source={t("generationSource")}
          />
          <div className="col-span-2 min-w-0 md:col-span-4 xl:col-span-1">
            <div className="text-sm text-ink-2">{t("lastTx")}</div>
            <div className="mt-1.5">
              {lastTx ? (
                <TxStatus
                  label={TX_KINDS.has(lastTx.kind) ? t(`tx.${lastTx.kind}`) : lastTx.kind}
                  status={lastTx.status}
                  hash={lastTx.tx_hash}
                  href={lastTx.explorer_url}
                />
              ) : (
                <span className="text-lg italic text-muted">{t("noneYet")}</span>
              )}
            </div>
          </div>
        </div>
        )}
      </section>
      <LiveGpu state={state} stale={stale} />
      </div>

      {/* 2. Loss and providers on the left, the recovery story down the right: fits one 1080p screen. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-4">
          <Panel
            title={t("lossTitle")}
            subtitle={t("lossSubtitle")}
            actions={
              <button
                type="button"
                aria-pressed={showTable}
                onClick={() => setShowTable((v) => !v)}
                className={buttonStyles("ghost", "sm")}
              >
                {t(showTable ? "hideTable" : "showTable")}
              </button>
            }
          >
            <LossChart state={state} showTable={showTable} />
          </Panel>
          <section aria-label={t("providersAria")} className="panel rounded-2xl border border-line p-4">
            <ProviderGrid state={state} />
          </section>
        </div>
        {/* On wide screens this column takes the left column's height and scrolls inside,
            so a long recovery history never pushes the page past one screen. */}
        <Panel
          title={t("recoveries")}
          subtitle={t("recoveriesSubtitle")}
          className="flex flex-col xl:h-0 xl:min-h-full xl:self-stretch"
          bodyClassName="min-h-0 flex-1 xl:overflow-y-auto"
        >
          <RecoveryTimeline state={state} compact />
        </Panel>
      </div>
    </div>
  );
}
