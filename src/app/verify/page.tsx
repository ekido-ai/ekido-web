"use client";

import { useRef, useState } from "react";
import { ExternalLink, Gauge, Radio, ShieldCheck } from "lucide-react";
import Link from "next/link";
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

const SOURCE: Record<string, string> = { chain: "Read from the chain", recomputed: "Recomputed in your browser", coordinator: "From the coordinator" };

export default function VerifyPage() {
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
      setError(e instanceof Error ? e.message : "The check couldn't finish.");
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
      setWithdrawalError(e instanceof Error ? e.message : "The withdrawal check couldn't finish.");
    } finally {
      setWithdrawalBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Verify this payout">
        Your browser reads the verdict from a chain transaction and checks it against checkpoint and provider details supplied by the coordinator.
      </PageHeader>

      {mode !== "live" ? (
        <EmptyState
          title="Not available for a recording"
          action={
            <Button variant="primary" onClick={() => setMode("live")}>
              <Radio className="size-4" aria-hidden /> Switch to live
            </Button>
          }
        >
          A recording can&apos;t be checked against a chain: the chain it ran on is gone. Switch to live, run a job to the end, then come back here.
        </EmptyState>
      ) : live.connection === "offline" || live.connection === "reconnecting" ? (
        <EmptyState
          title="Not available: the coordinator is offline"
          action={
            <Link href="/dashboard" className={buttonStyles("secondary", "md")}>
              <Gauge className="size-4" aria-hidden /> Go to mission control
            </Link>
          }
        >
          The check needs the job details from the coordinator. Mission control shows how to start it, or lets you watch the recording.
        </EmptyState>
      ) : !settled ? (
        <EmptyState
          title="Not available yet: no settled job"
          action={
            <Link href="/dashboard" className={buttonStyles("secondary", "md")}>
              <Gauge className="size-4" aria-hidden /> Go to mission control
            </Link>
          }
        >
          This check runs once the newest job is paid out on-chain. Start a job on mission control and let it finish.
        </EmptyState>
      ) : (
        <Panel
          title="Newest settled job"
          subtitle={state.jobId ?? undefined}
          actions={
            <Button variant="primary" onClick={run} disabled={busy}>
              <ShieldCheck className="size-4" aria-hidden /> {busy ? "Checking…" : result ? "Check again" : "Run the checks"}
            </Button>
          }
        >
          {error && <ErrorState title="The check couldn't finish" detail={error} onRetry={run} />}
          {!result && !error && <p className="text-ink-2">Nothing has been checked yet. It takes a few seconds and sends no transactions.</p>}
          {result && (
            <>
              <p className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink" role="status">
                <StatusIcon tone={failed ? "critical" : "good"} />
                {failed ? `${failed} of ${result.rows.length} checks failed` : `All ${result.rows.length} checks passed`}
              </p>
              <ul className="divide-y divide-line">
                {result.rows.map((row) => (
                  <li key={row.title} className="flex items-start gap-3 py-2.5">
                    <StatusIcon tone={row.passed ? "good" : "critical"} className="mt-1 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{row.title}</div>
                      <div className="break-words text-sm text-ink-2">{row.detail}</div>
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-muted">{SOURCE[row.source]}</span>
                  </li>
                ))}
              </ul>
              {result.explorer && (
                <a href={result.explorer} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink underline">
                  See the transaction on BaseScan <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </>
          )}
        </Panel>
      )}

      <Panel title="Check a withdrawal transaction" subtitle="Read-only check against the configured chain and escrow. A withdrawal can combine credits from several jobs.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-ink">Transaction hash
            <input ref={hashField} value={withdrawalHash} onChange={(e) => { setWithdrawalHash(e.target.value); setWithdrawal(null); }} className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink" placeholder="0x…" />
          </label>
          <label className="space-y-1 text-sm text-ink">Recipient wallet
            <input ref={walletField} value={withdrawalWallet} onChange={(e) => { setWithdrawalWallet(e.target.value); setWithdrawal(null); }} className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink" placeholder="0x…" />
          </label>
        </div>
        <div className="mt-4"><Button onClick={checkWithdrawal} disabled={withdrawalBusy}>{withdrawalBusy ? "Checking…" : "Check withdrawal"}</Button></div>
        {withdrawalError && <div className="mt-4"><ErrorState title="Withdrawal not verified" detail={withdrawalError} /></div>}
        {withdrawal && <p className="mt-4 text-sm text-ink" role="status">The configured escrow emitted a withdrawal of {fromMicros(withdrawal.amount)} token units (6 decimals) to {withdrawal.wallet} in block {withdrawal.blockNumber.toString()}. This does not identify which job funded those credits.</p>}
      </Panel>

      <Panel title="What this doesn't prove">
        <ul className="list-disc space-y-1.5 pl-5 text-ink-2">
          <li>That the training itself ran as claimed. Payment rests on the quality test, not on a proof of execution.</li>
          <li>That the verifiers were honest. They&apos;re run by our team, so a quorum of them could sign a bad result.</li>
          <li>That checkpoint steps, signers, provider wallets or prices are authentic. The coordinator supplies those details; coordinated changes can make an incorrect payout appear consistent.</li>
          <li>That the configured escrow address is trustworthy. Check it independently before relying on the contract identity check.</li>
          <li>What&apos;s inside the checkpoints or quality reports. These checks do not open or authenticate their contents.</li>
          <li>The current verifier workers also trust the coordinator&apos;s proposed payout split.</li>
          <li>This reads through one RPC node. A careful checker would use their own.</li>
        </ul>
      </Panel>
    </div>
  );
}
