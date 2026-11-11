"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";

type Sent = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; error: string };

/**
 * Starts a job through experiments/demo_stack.py's local helper, which funds the escrow from the
 * demo client wallet on the local chain. A real client uses New job and their own wallet.
 */
export function StartDemoJob({ jobState, align = "end" }: { jobState: string | null; align?: "start" | "end" }) {
  const [sent, setSent] = useState<Sent>({ kind: "idle" });
  const [seenState, setSeenState] = useState(jobState);
  if (seenState !== jobState) {
    setSeenState(jobState);
    if (sent.kind === "sent") setSent({ kind: "idle" });
  }

  async function start() {
    setSent({ kind: "sending" });
    try {
      const response = await fetch(`${config.demoHelperUrl}/start-job`, { method: "POST", headers: config.hostedDemo ? { "Content-Type": "application/json" } : undefined, body: config.hostedDemo ? "{}" : undefined, signal: AbortSignal.timeout(8000) });
      if (response.status === 409) setSent({ kind: "error", error: "A job is still starting. Give it a moment." });
      else if (!response.ok) setSent({ kind: "error", error: `The demo helper answered ${response.status}.` });
      else setSent({ kind: "sent" });
    } catch {
      setSent({
        kind: "error",
        error: "Can't reach the demo helper on port 8001. It starts with experiments/demo_stack.py (local chain only). New job stays off until signed quotes are in.",
      });
    }
  }

  return (
    <div className={align === "end" ? "flex flex-col items-start gap-2 sm:items-end" : "flex flex-col items-start gap-2"}>
      <Button variant="primary" size="lg" onClick={start} disabled={sent.kind === "sending" || sent.kind === "sent"}>
        <Play className="size-5" aria-hidden /> {sent.kind === "sent" ? "Starting…" : "Start demo job"}
      </Button>
      <span className={align === "end" ? "max-w-80 text-xs text-muted sm:text-right" : "max-w-xl text-sm text-ink-2"} role="status">
        {sent.kind === "error" ? (
          <span className="text-ink">{sent.error}</span>
        ) : sent.kind === "sent" ? (
          "Asked the demo helper to start a job. It appears here within a few seconds."
        ) : (
          "Synthetic CPU demo using test funds on a local chain."
        )}
      </span>
    </div>
  );
}
