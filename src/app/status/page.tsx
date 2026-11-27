"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
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

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** `t` is useTranslations("statusPage"). Errors from the network or RPC library are shown as they come. */
async function runChecks(t: Translate): Promise<Check[]> {
  const { reads, logs } = chainClients();
  const settle = async (name: string, what: string, fn: () => Promise<string>): Promise<Check> => {
    try {
      return { name, what, tone: "good", detail: await fn() };
    } catch (e) {
      return { name, what, tone: "critical", detail: e instanceof Error ? e.message.split("\n")[0].slice(0, 140) : t("unreachable") };
    }
  };
  return Promise.all([
    settle(t("coordinator.name"), t("coordinator.what"), async () => {
      // /readyz is public on every server; the provider list may be private, which is not a fault.
      const [res, ms] = await timed(() => fetch(`${config.coordinatorUrl}/readyz`, { signal: AbortSignal.timeout(6000) }));
      if (res.status === 429) return t("coordinator.busy", { ms });
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok || body.status !== "ready") throw new Error(t("coordinator.notReady", { status: res.status }));
      return t("coordinator.ready", { ms });
    }),
    settle(t("rpc.name", { chain: BASE_SEPOLIA.name }), t("rpc.what"), async () => {
      const [block, ms] = await timed(() => reads.getBlockNumber());
      return t("block", { block: block.toLocaleString("en-US"), ms });
    }),
    settle(t("logs.name"), t("logs.what"), async () => {
      const [block, ms] = await timed(() => logs.getBlockNumber());
      return t("block", { block: block.toLocaleString("en-US"), ms });
    }),
    settle(t("escrow.name"), t("escrow.what"), async () => {
      const code = await reads.getCode({ address: BASE_SEPOLIA.escrow });
      if (!code || code === "0x") throw new Error(t("escrow.noCode"));
      return t("escrow.deployed", { bytes: ((code.length - 2) / 2).toLocaleString("en-US") });
    }),
  ]);
}

export default function StatusPage() {
  const t = useTranslations("statusPage");
  const [checks, setChecks] = useState<Check[] | null>(null);
  // Busy from the start: the first round of checks runs as soon as the page opens.
  const [busy, setBusy] = useState(true);
  const [at, setAt] = useState<string | null>(null);

  const check = useCallback(
    () =>
      runChecks(t).then((c) => {
        setChecks(c);
        setAt(new Date().toLocaleTimeString());
        setBusy(false);
      }),
    [t],
  );
  const run = () => {
    setBusy(true);
    void check();
  };

  useEffect(() => {
    void check();
  }, [check]);

  const down = checks?.filter((c) => c.tone !== "good").length ?? 0;

  return (
    <Doc title={t("title")} updated={t("updated")} intro={t("intro")}>
      <Section id="checks" title={checks ? (down ? t("down", { down, total: checks.length }) : t("allUp")) : t("checking")}>
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
          {!checks && <li className="px-5 py-3">{t("running")}</li>}
        </ul>
        <div className="flex items-center gap-3">
          <Button onClick={run} disabled={busy}>
            <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} aria-hidden />
            {t("again")}
          </Button>
          {at && <span className="text-sm text-muted">{t("lastChecked", { at })}</span>}
        </div>
      </Section>
    </Doc>
  );
}
