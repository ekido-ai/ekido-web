"use client";

import { Pause, Play, Radio, RotateCcw, SkipForward, History } from "lucide-react";
import { useDashboard, usePlayer, usePlayerSnapshot, useSourceControl } from "@/lib/events/source-context";
import { describeStage, formatClock } from "@/lib/events/describe";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status";
import { Stat } from "@/components/ui/stat";
import { TruthBadge } from "@/components/ui/truth-badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/shell/page-header";
import { cx } from "@/components/ui/cx";
import { connectionView } from "@/components/shell/connection";
import { CoordinatorHelp } from "@/components/shell/coordinator-offline";

const SPEEDS = [0.5, 1, 2, 4, 8];

function ReplayControls() {
  const player = usePlayer();
  const snap = usePlayerSnapshot();
  const rec = player.recording;
  return (
    <Panel title="Replay controls" subtitle={`${rec.title}. ${rec.description}`}>
      <div className="flex flex-wrap items-center gap-3">
        {snap.playing ? (
          <Button variant="primary" onClick={() => player.pause()}>
            <Pause className="size-4" aria-hidden /> Pause
          </Button>
        ) : (
          <Button variant="primary" onClick={() => player.play()}>
            <Play className="size-4" aria-hidden /> {snap.index >= snap.total ? "Replay from start" : "Play"}
          </Button>
        )}
        <Button onClick={() => player.stepForward()} disabled={snap.index >= snap.total}>
          <SkipForward className="size-4" aria-hidden /> Next event
        </Button>
        <Button variant="ghost" onClick={() => player.seek(0)}>
          <RotateCcw className="size-4" aria-hidden /> Reset
        </Button>
        <div role="group" aria-label="Playback speed" className="flex rounded-lg border border-line-strong p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={snap.speed === s}
              onClick={() => player.setSpeed(s)}
              className={cx(
                "tabular rounded-md px-2.5 py-1 text-sm font-medium",
                snap.speed === s ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="tabular w-12 text-right font-mono text-sm text-ink-2">{formatClock(snap.positionMs)}</span>
        <input
          type="range"
          aria-label="Position in recording"
          min={0}
          max={snap.durationMs}
          step={500}
          value={snap.positionMs}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer accent-[var(--text)]"
        />
        <span className="tabular w-12 font-mono text-sm text-ink-2">{formatClock(snap.durationMs)}</span>
      </div>
      <div className="mt-4">
        <Stat label="Events applied" value={`${snap.index} / ${snap.total}`} />
      </div>
    </Panel>
  );
}

function LiveStatus() {
  const { live } = useDashboard();
  const { watchRecording, retryLive } = useSourceControl();
  const c = connectionView[live.connection];
  return (
    <Panel title="Live connection" subtitle="Events from the coordinator's job stream">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={c.tone} size="lg">
          {c.label}
        </StatusPill>
        {live.hello && (
          <span className="text-sm text-ink-2">
            Server: <span className="font-mono text-ink">{live.hello.server}</span>
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Stream</dt>
        <dd className="break-all font-mono text-ink">{live.url}</dd>
        <dt className="text-muted">REST</dt>
        <dd className="break-all font-mono text-ink">{config.coordinatorUrl}</dd>
        <dt className="text-muted">Last message</dt>
        <dd className="text-ink">
          {live.lastMessageAt ? new Date(live.lastMessageAt).toLocaleTimeString() : <span className="italic text-muted">none yet</span>}
        </dd>
        {live.failures > 0 && (
          <>
            <dt className="text-muted">Failed attempts</dt>
            <dd className="tabular text-ink">{live.failures}</dd>
          </>
        )}
        {live.error && live.connection !== "live" && (
          <>
            <dt className="text-muted">Last error</dt>
            <dd className="text-ink">{live.error}</dd>
          </>
        )}
      </dl>
      {live.connection !== "live" && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-2 font-semibold text-ink">Not connected? Start the stack</h3>
          <CoordinatorHelp />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => watchRecording(2)}>
              <History className="size-4" aria-hidden /> Watch the recorded run
            </Button>
            <Button onClick={retryLive}>Retry now</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function SourcePage() {
  const view = useDashboard();
  const { mode, setMode } = useSourceControl();
  const { state } = view;
  const stage = describeStage(state);
  const recent = state.log.slice(-40).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data source"
        aside={
          view.provenance !== "live" ? <TruthBadge truth={view.provenance === "sample" ? "SAMPLE" : "RECORDED"} /> : undefined
        }
      >
        Every screen reads from one event stream. Replay plays recorded events, so UI work and the demo fallback never
        wait on the backend. Live reads the coordinator.
      </PageHeader>

      <div role="radiogroup" aria-label="Data source" className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { m: "replay", icon: History, title: "Recorded", text: "The 4 Nov real run, played back. Works with no backend" },
            { m: "live", icon: Radio, title: "Live", text: "The coordinator's real-time job stream. Needs the stack running" },
          ] as const
        ).map(({ m, icon: Icon, title, text }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cx(
              "flex items-start gap-3 rounded-xl border p-4 text-left",
              mode === m ? "border-ink-2 bg-surface-2" : "border-line bg-surface hover:bg-surface-2",
            )}
          >
            <Icon className="mt-0.5 size-5 text-ink-2" aria-hidden />
            <span>
              <span className="block font-semibold text-ink">{title}</span>
              <span className="block text-sm text-ink-2">{text}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === "replay" ? <ReplayControls /> : <LiveStatus />}

      <Panel title="Right now" subtitle="The plain-language line mission control leads with">
        <StatusPill tone={stage.tone} size="lg">
          {stage.headline}
        </StatusPill>
        {stage.detail && <p className="mt-2 text-ink-2">{stage.detail}</p>}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Job state" value={state.jobState} />
          <Stat label="Fencing token" value={state.fencingToken || null} />
          <Stat
            label="Latest step"
            value={state.progress.at(-1)?.step ?? null}
            unit={state.progress.length ? `of ${state.progress.at(-1)!.total_steps}` : undefined}
          />
        </div>
      </Panel>

      <Panel title="Event stream" subtitle="Newest first, last 40. Open a row for its raw payload">
        {recent.length === 0 ? (
          <EmptyState title="No events yet">
            {mode === "replay" ? "Press Play or Next event." : "Waiting for the first event from the coordinator."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((e) => (
              <li key={e.seq}>
                <details className="group py-1.5">
                  <summary className="flex cursor-pointer list-none items-baseline gap-3 text-sm">
                    <span className="tabular w-10 shrink-0 text-right font-mono text-xs text-muted">#{e.seq}</span>
                    <span className="tabular shrink-0 font-mono text-xs text-muted">{e.ts.slice(11, 19)}</span>
                    <span className="font-mono text-ink">{e.type}</span>
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs text-ink-2">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
