"use client";

import { useState } from "react";
import { Skull } from "lucide-react";
import type { DashboardState } from "@/lib/events/reduce";
import type { Provenance, SourceMode } from "@/lib/events/source-context";
import { shortProviderName } from "@/lib/events/derive";
import { post } from "@/lib/live/api";
import { config } from "@/lib/config";
import { ConfirmButton } from "@/components/ui/button";
import { StatusIcon } from "@/components/ui/status";

type Sent = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; at: string; failuresBefore: number } | { kind: "error"; error: string };

/**
 * The demo's Kill button. In live mode it calls POST /demo/faults (only enabled when the
 * coordinator runs with DEMO_MODE=1). "Sent" is not "killed": the line below waits for the
 * coordinator's failure.detected event before saying the kill happened.
 */
export function KillControl({
  state,
  mode,
  provenance,
  connected,
}: {
  state: DashboardState;
  mode: SourceMode;
  provenance: Provenance;
  connected: boolean;
}) {
  const [sent, setSent] = useState<Sent>({ kind: "idle" });
  const target = state.jobState === "RUNNING" ? state.activeProviderId : null;
  const name = shortProviderName(state, target);
  const isLive = mode === "live";
  // A note about the last kill belongs to that provider. Once training moves on, start fresh.
  const [seenTarget, setSeenTarget] = useState(target);
  if (seenTarget !== target) {
    setSeenTarget(target);
    if (target !== null && (sent.kind === "sent" || sent.kind === "error")) setSent({ kind: "idle" });
  }

  const detected = sent.kind === "sent" && state.failures.length > sent.failuresBefore;

  async function kill() {
    if (!state.jobId || !target) return;
    setSent({ kind: "sending" });
    // One key per press: a retry of this same request can't kill twice.
    let res;
    if (config.hostedDemo) {
      try {
        const response = await fetch(`${config.demoHelperUrl}/kill`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: state.jobId }), signal: AbortSignal.timeout(8000) });
        const data = await response.json();
        res = response.ok && data.delivered ? { ok: true as const } : { ok: false as const, error: data.error || "The provider could not be stopped." };
      } catch {
        res = { ok: false as const, error: "Couldn't reach the hosted demo control." };
      }
    } else {
      res = await post<{ fault_id: string }>("/demo/faults", { job_id: state.jobId, kind: "KILL_CONTAINER" });
    }
    setSent(
      res.ok
        ? { kind: "sent", at: new Date().toLocaleTimeString(), failuresBefore: state.failures.length }
        : { kind: "error", error: res.error },
    );
  }

  let note: React.ReactNode;
  if (!isLive) note = "Disabled in replay. The kill is part of the recording.";
  else if (!connected) note = "Disconnected from the coordinator, so a kill can't be sent.";
  else if (sent.kind === "sending") note = <><StatusIcon tone="active" className="size-3.5" /> Sending kill…</>;
  else if (sent.kind === "error") note = <><StatusIcon tone="critical" className="size-3.5" /> {sent.error}</>;
  else if (detected)
    note =
      provenance === "live" ? (
        <><StatusIcon tone="good" className="size-3.5" /> Coordinator detected the failure</>
      ) : (
        <><StatusIcon tone="neutral" className="size-3.5" /> A failure arrived, but it is the sample&apos;s own, not this kill</>
      );
  else if (sent.kind === "sent") note = <><StatusIcon tone="active" className="size-3.5" /> Kill sent at {sent.at}. Waiting for the coordinator to notice</>;
  else if (!target) note = "Available while a provider is training. Nothing is training right now.";
  else if (provenance !== "live") note = "Sends the kill to the coordinator, but this stream is sample data with its own kill.";
  else note = "Really kills the training process. Press twice.";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <ConfirmButton
        size="lg"
        disabled={!isLive || !connected || !target || sent.kind === "sending"}
        onConfirm={kill}
        confirmLabel={`Press again to kill ${name}`}
      >
        <Skull className="size-5" aria-hidden /> Kill {target ? name : "provider"}
      </ConfirmButton>
      <span className="flex max-w-80 items-center gap-1.5 text-xs text-muted sm:justify-end sm:text-right" role="status">
        {note}
      </span>
    </div>
  );
}
