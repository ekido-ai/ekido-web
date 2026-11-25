"use client";

import { useRef, useState } from "react";
import { ExternalLink, Gauge, Radio, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDashboard, useSourceControl } from "@/lib/events/source-context";
import { buttonStyles } from "@/components/ui/button-styles";
import { verifyPayout, type VerifyResult } from "@/lib/verify/check";
import { verifyWithdrawal, type WithdrawalProof } from "@/lib/verify/withdrawal";
import { fromMicros } from "@/lib/receipt/receipt";
import { config } from "@/lib/config";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/ui/status";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useTypedBeforeHydration } from "@/components/ui/typed-before-hydration";

// Where each check's answer came from; labels are in messages (demo.verify.source.<source>).
const SOURCES = new Set(["chain", "recomputed", "coordinator"]);
const LIMITS = ["training", "verifiers", "details", "escrow", "contents", "split", "rpc"] as const;

export default function VerifyPage() {
  const t = useTranslations("demo.verify");
  const { state, mode, live } = useDashboard();
  const { setMode } = useSourceControl();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawalHash, setWithdrawalHash] = useState("");
  const [withdrawalWallet, setWithdrawalWallet] = useState("");
  // Text typed before the script loaded would be wiped by the first re-render (ekido-ai/ekido-core#125).
  const hashField = useRef<HTMLInputElement>(null);
  const walletField = useRef<HTMLInputElement>(null);
  useTypedBeforeHydration(hashField, setWithdrawalHash);
  useTypedBeforeHydration(walletField, setWithdrawalWallet);
  const [withdrawal, setWithdrawal] = useState<WithdrawalProof | null>(null);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalBusy, setWithdrawalBusy] = useState(false);
  const local = state.chain.some((tx) => tx.chain === "anvil");
  const settled = state.jobState === "SETTLED";
  const failed = result?.rows.filter((row) => !row.passed).length ?? 0;

  async function run() {
    if (!state.jobId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await verifyPayout(state.jobId, local));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedFallback"));
    } finally {
      setBusy(false);
    }
  }

  async function checkWithdrawal() {
    setWithdrawalBusy(true);
    setWithdrawalError(null);
    setWithdrawal(null);
    try {
      setWithdrawal(await verifyWithdrawal(withdrawalHash.trim(), withdrawalWallet.trim(), config.escrowAddress, config.rpcUrl, config.chainId));
    } catch (e) {
      setWithdrawalError(e instanceof Error ? e.message : t("withdrawalFallback"));
    } finally {
      setWithdrawalBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        {t("lead")}
      </PageHeader>

      {mode !== "live" ? (
        <EmptyState
          title={t("recordingTitle")}
          action={
            <Button variant="primary" onClick={() => setMode("live")}>
              <Radio className="size-4" aria-hidden /> {t("switchToLive")}
            </Button>
          }
        >
          {t("recording")}
        </EmptyState>
      ) : live.connection === "offline" || live.connection === "reconnecting" ? (
        <EmptyState
          title={t("offlineTitle")}
          action={
            <Link href="/dashboard" className={buttonStyles("secondary", "md")}>
              <Gauge className="size-4" aria-hidden /> {t("missionControl")}
            </Link>
          }
        >
          {t("offline")}
        </EmptyState>
      ) : !settled ? (
        <EmptyState
          title={t("notSettledTitle")}
          action={
            <Link href="/dashboard" className={buttonStyles("secondary", "md")}>
              <Gauge className="size-4" aria-hidden /> {t("missionControl")}
            </Link>
          }
        >
          {t("notSettled")}
        </EmptyState>
      ) : (
        <Panel
          title={t("newest")}
          subtitle={state.jobId ?? undefined}
          actions={
            <Button variant="primary" onClick={run} disabled={busy}>
              <ShieldCheck className="size-4" aria-hidden /> {t(busy ? "checking" : result ? "checkAgain" : "run")}
            </Button>
          }
        >
          {error && <ErrorState title={t("failedTitle")} detail={error} onRetry={run} />}
          {!result && !error && <p className="text-ink-2">{t("notYet")}</p>}
          {result && (
            <>
              <p className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink" role="status">
                <StatusIcon tone={failed ? "critical" : "good"} />
                {failed ? t("someFailed", { failed, total: result.rows.length }) : t("allPassed", { total: result.rows.length })}
              </p>
              <ul className="divide-y divide-line">
                {result.rows.map((row) => (
                  <li key={row.title} className="flex items-start gap-3 py-2.5">
                    <StatusIcon tone={row.passed ? "good" : "critical"} className="mt-1 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{row.title}</div>
                      <div className="break-words text-sm text-ink-2">{row.detail}</div>
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-muted">{SOURCES.has(row.source) ? t(`source.${row.source}`) : row.source}</span>
                  </li>
                ))}
              </ul>
              {result.explorer && (
                <a href={result.explorer} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink underline">
                  {t("basescan")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </>
          )}
        </Panel>
      )}

      <Panel title={t("withdrawalTitle")} subtitle={t("withdrawalSubtitle")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-ink">{t("txHash")}
            <input ref={hashField} value={withdrawalHash} onChange={(e) => { setWithdrawalHash(e.target.value); setWithdrawal(null); }} className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink" placeholder="0x…" />
          </label>
          <label className="space-y-1 text-sm text-ink">{t("recipient")}
            <input ref={walletField} value={withdrawalWallet} onChange={(e) => { setWithdrawalWallet(e.target.value); setWithdrawal(null); }} className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink" placeholder="0x…" />
          </label>
        </div>
        <div className="mt-4"><Button onClick={checkWithdrawal} disabled={withdrawalBusy}>{t(withdrawalBusy ? "checking" : "checkWithdrawal")}</Button></div>
        {withdrawalError && <div className="mt-4"><ErrorState title={t("withdrawalFailedTitle")} detail={withdrawalError} /></div>}
        {withdrawal && <p className="mt-4 text-sm text-ink" role="status">{t("withdrawalOk", { amount: fromMicros(withdrawal.amount), wallet: withdrawal.wallet, block: withdrawal.blockNumber.toString() })}</p>}
      </Panel>

      <Panel title={t("limitsTitle")}>
        <ul className="list-disc space-y-1.5 pl-5 text-ink-2">
          {LIMITS.map((k) => (
            <li key={k}>{t(`limits.${k}`)}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
