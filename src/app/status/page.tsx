"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { config } from "@/lib/config";
import { BASE_SEPOLIA, chainClients } from "@/lib/chain/read";
import { Button } from "@/components/ui/button";
import { StatusIcon, type Tone } from "@/components/ui/status";
import { Doc, Section } from "@/components/legal/doc";

interface Check {
  name: string;
  what: string;
  tone: Tone;
  detail: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const value = await fn();
  return [value, Math.round(performance.now() - t0)];
}

async function runChecks(): Promise<Check[]> {
  const { reads, logs } = chainClients();
  const settle = async (name: string, what: string, fn: () => Promise<string>): Promise<Check> => {
    try {
      return { name, what, tone: "good", detail: await fn() };
    } catch (e) {
      return { name, what, tone: "critical", detail: e instanceof Error ? e.message.split("\n")[0].slice(0, 140) : "Unreachable" };
    }
  };
  return Promise.all([
    settle("Coordinator", "Schedules jobs and streams progress", async () => {
      // /readyz is public on every server; the provider list may be private, which is not a fault.
      const [res, ms] = await timed(() => fetch(`${config.coordinatorUrl}/readyz`, { signal: AbortSignal.timeout(6000) }));
      if (res.status === 429) return `Busy: it asked this page to slow down, answered in ${ms} ms`;
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok || body.status !== "ready") throw new Error(`Not ready (answered ${res.status})`);
      return `Ready, answered in ${ms} ms`;
    }),
    settle(`${BASE_SEPOLIA.name} RPC`, "Reads balances and contract state", async () => {
      const [block, ms] = await timed(() => reads.getBlockNumber());
      return `Block ${block.toLocaleString("en-US")}, answered in ${ms} ms`;
    }),
    settle("Event history RPC", "Reads the escrow's past events", async () => {
      const [block, ms] = await timed(() => logs.getBlockNumber());
      return `Block ${block.toLocaleString("en-US")}, answered in ${ms} ms`;
    }),
    settle("Escrow contract", "Holds budgets and pays out", async () => {
      const code = await reads.getCode({ address: BASE_SEPOLIA.escrow });
      if (!code || code === "0x") throw new Error("No contract code at the escrow address");
      return `Deployed, ${((code.length - 2) / 2).toLocaleString("en-US")} bytes of code`;
    }),
  ]);
}

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setChecks(await runChecks());
    setAt(new Date().toLocaleTimeString());
    setBusy(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const down = checks?.filter((c) => c.tone !== "good").length ?? 0;

  return (
    <Doc title="Status" updated="live" intro="Each check runs from your browser right now, so it shows what you can reach, not what we say.">
      <Section title={checks ? (down ? `${down} of ${checks.length} parts unreachable` : "Everything reachable") : "Checking"}>
        <ul className="divide-y divide-line panel rounded-2xl border border-line [&_li]:ml-0 [&_li]:list-none" aria-live="polite">
          {(checks ?? []).map((c) => (
            <li key={c.name} className="flex items-start gap-3 px-5 py-3">
              <StatusIcon tone={c.tone} className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-ink">{c.name}</div>
                <div className="text-sm">{c.what}</div>
                <div className="text-sm text-ink [overflow-wrap:anywhere]">{c.detail}</div>
              </div>
            </li>
          ))}
          {!checks && <li className="px-5 py-3">Running four checks…</li>}
        </ul>
        <div className="flex items-center gap-3">
          <Button onClick={run} disabled={busy}>
            <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} aria-hidden />
            Check again
          </Button>
          {at && <span className="text-sm text-muted">Last checked {at}</span>}
        </div>
      </Section>
    </Doc>
  );
}
