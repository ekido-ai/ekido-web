"use client";

import { useSyncExternalStore } from "react";
import { History, RefreshCw, ServerOff, TriangleAlert } from "lucide-react";
import { useDashboard, useSourceControl } from "@/lib/events/source-context";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

/** The coordinator only accepts this dashboard from these ports (its CORS list). */
const ALLOWED_PORTS = ["3000", "3100"];

const noop = () => () => {};
function usePagePort(): string | null {
  return useSyncExternalStore(noop, () => window.location.port || "80", () => null);
}

/** The exact commands to bring the stack up, so recovery never means asking someone. */
export function CoordinatorHelp({ className }: { className?: string }) {
  const port = usePagePort();
  const wrongPort = port !== null && !ALLOWED_PORTS.includes(port);
  return (
    <div className={cx("space-y-3 text-sm", className)}>
      {wrongPort && (
        <p className="flex items-start gap-2 rounded-lg border border-warning bg-surface-2 px-3 py-2 text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            This page is on port <b>{port}</b>. The coordinator only answers dashboards on port 3000 or 3100, so restart it
            with <code className="font-mono">npx next start -p 3100</code>.
          </span>
        </p>
      )}
      <ol className="list-decimal space-y-3 pl-5 text-ink-2 marker:text-muted">
        <li>
          From the repo root, start the CPU stack (no GPU, no Docker):
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-ink">
            {"# Windows\n.cache\\cpu-venv\\Scripts\\python.exe experiments\\demo_stack.py --cpu --no-docker --total-steps 60000\n# macOS / Linux\n.cache/cpu-venv/bin/python experiments/demo_stack.py --cpu --no-docker --total-steps 60000"}
          </pre>
          <span className="mt-1 block text-xs text-muted">
            The GPU stack (<code className="font-mono">experiments/demo_stack.py</code> without <code className="font-mono">--cpu</code>) uses the
            real GPU, and <code className="font-mono">--no-docker</code> runs it without Docker. 60000 steps leaves time to press Kill; 6000 finishes in seconds on a fast CPU.
          </span>
        </li>
        <li>
          Wait for it to print the API address. It should be <code className="font-mono text-ink">{config.coordinatorUrl}</code>.
        </li>
        <li>This page reconnects by itself within a few seconds. Or press Retry now.</li>
      </ol>
    </div>
  );
}

/**
 * Shown when live mode can't reach the coordinator. Never a dead end: the recorded run is one
 * press away, retry is explicit, and the steps to start the stack are right there.
 */
export function CoordinatorOffline({ compact = false }: { compact?: boolean }) {
  const { live } = useDashboard();
  const { watchRecording, retryLive } = useSourceControl();
  const everConnected = live.lastMessageAt !== null;
  const title = everConnected ? "Lost the connection to the coordinator" : "The coordinator isn't running";
  const since = live.lastMessageAt ? new Date(live.lastMessageAt).toLocaleTimeString() : null;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" size={compact ? "md" : "lg"} onClick={() => watchRecording(2)}>
        <History className="size-4" aria-hidden /> Watch the recorded run
      </Button>
      <Button size={compact ? "md" : "lg"} onClick={retryLive}>
        <RefreshCw className="size-4" aria-hidden /> Retry now
      </Button>
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning bg-surface px-4 py-3" role="status">
        <p className="flex min-w-0 items-start gap-2.5 text-sm text-ink">
          <ServerOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <b className="font-semibold">{title}.</b>{" "}
            {since ? `Showing what we last heard at ${since}; it may be stale. ` : ""}
            Retrying every 3 s.
          </span>
        </p>
        {actions}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl panel rounded-2xl border border-line p-6 sm:p-8" role="status" aria-live="polite">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2">
          <ServerOff className="size-5 text-warning" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-ink-2">
            Live mode shows a real job from the coordinator at <code className="font-mono text-ink">{config.coordinatorUrl}</code>,
            and nothing is answering there. You can watch the recording of the 4 Nov run instead. It is clearly
            labelled as recorded on every screen.
          </p>
        </div>
      </div>
      <div className="mt-6">{actions}</div>
      <details className="group mt-6 rounded-xl border border-line bg-bg/40 px-4 py-3">
        <summary className="cursor-pointer list-none font-semibold text-ink">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
          How to start the coordinator
        </summary>
        <CoordinatorHelp className="mt-3" />
      </details>
      <p className="mt-4 break-words text-xs text-muted">
        {live.failures > 0 ? `Tried ${live.failures} time${live.failures === 1 ? "" : "s"}. ` : ""}
        {live.error ?? ""}
      </p>
    </section>
  );
}
