"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Radio, RefreshCw } from "lucide-react";
import { config } from "@/lib/config";
import { useDashboard, useSourceControl } from "@/lib/events/source-context";
import { usdc } from "@/lib/events/views";
import {
  RECEIPT_LIMITS,
  loadLedger,
  receiptCsv,
  receiptJson,
  stageOf,
  stageText,
  totals,
  type Ledger,
  type SettlementRow,
  type Stage,
} from "@/lib/earnings/ledger";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { StatusIcon, StatusPill, type Tone } from "@/components/ui/status";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { cx } from "@/components/ui/cx";
import { usePrivateListsReadable } from "@/lib/platform/signed-in";

const stageTone: Record<Stage, Tone> = { proposed: "warning", reported: "neutral", disputed: "serious", refund_only: "idle", error: "critical" };
const stageShort: Record<Stage, string> = {
  proposed: "Proposed",
  reported: "Reported finalized",
  disputed: "Disputed",
  refund_only: "Refund only",
  error: "Error",
};

const short = (h: string) => (h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h);
const money = (units: number) => `${usdc(units)} USDC`;

function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function get(path: string) {
  const res = await fetch(config.coordinatorUrl.replace(/\/$/, "") + path, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function Tx({ hash }: { hash: string | null }) {
  if (!hash) return <span className="text-muted">none</span>;
  return config.explorer ? (
    <a className="font-mono underline decoration-line-strong underline-offset-2 hover:text-ink" href={`${config.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
      {short(hash)}
    </a>
  ) : (
    <code className="font-mono" title={hash}>{short(hash)}</code>
  );
}

function Receipt({ row }: { row: SettlementRow }) {
  const stamp = () => new Date().toISOString();
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        className={buttonStyles("ghost", "sm")}
        onClick={() => download(`receipt-${row.job_id}.csv`, "text/csv", receiptCsv(row, stamp()))}
        aria-label={`Download CSV receipt for ${row.job_id}`}
      >
        <Download className="size-3.5" aria-hidden /> CSV
      </button>
      <button
        type="button"
        className={buttonStyles("ghost", "sm")}
        onClick={() => download(`receipt-${row.job_id}.json`, "application/json", receiptJson(row, stamp()))}
        aria-label={`Download JSON receipt for ${row.job_id}`}
      >
        <Download className="size-3.5" aria-hidden /> JSON
      </button>
    </div>
  );
}

function Amounts({ row }: { row: SettlementRow }) {
  if (!row.verdict) return <span className="italic text-muted">no verdict stored</span>;
  return (
    <ul className="space-y-0.5">
      {row.verdict.payees.map((p, i) => (
        <li key={p} className="tabular">
          <code className="font-mono text-ink-2" title={p}>{short(p)}</code> {money(row.verdict!.amounts[i])}
        </li>
      ))}
      <li className="tabular text-ink-2">Refund {money(row.verdict.refund)}</li>
    </ul>
  );
}

export default function EarningsPage() {
  const { mode } = useDashboard();
  const { setMode } = useSourceControl();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);
  // Settlements are private on a public server: a signed-out visitor is told to sign in, and nothing is asked
  // for that would only be refused (ekido-ai/ekido-internal#93).
  const readable = usePrivateListsReadable();

  useEffect(() => {
    if (mode !== "live" || readable !== true) return;
    let alive = true;
    loadLedger(get)
      .then((l) => {
        if (alive) setLedger(l);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(
          e instanceof TypeError || (e instanceof DOMException && e.name === "TimeoutError")
            ? `Couldn't reach the coordinator at ${config.coordinatorUrl}. Is it running?`
            : e instanceof Error
              ? e.message
              : "request failed",
        );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, nonce, readable]);

  const load = () => {
    setBusy(true);
    setError(null);
    setNonce((n) => n + 1);
  };

  const t = ledger ? totals(ledger.rows) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        aside={
          mode === "live" && readable === true && (
            <Button size="sm" onClick={() => load()} disabled={busy}>
              <RefreshCw className={cx("size-3.5", busy && "animate-spin motion-reduce:animate-none")} aria-hidden /> Refresh
            </Button>
          )
        }
      >
        What the coordinator says each provider is owed, job by job. These are its stored verdicts and its own status, not
        a read of the chain, so nothing here is called paid or verified.
      </PageHeader>

      {mode !== "live" ? (
        <EmptyState
          title="Not available for a recording"
          action={
            <button type="button" onClick={() => setMode("live")} className={buttonStyles("secondary", "md")}>
              <Radio className="size-4" aria-hidden /> Switch to live
            </button>
          }
        >
          Earnings reads every settlement from the live coordinator. The recording has one job; its split is on the{" "}
          <Link href="/settlement" className="underline underline-offset-2">Settlement</Link> screen.
        </EmptyState>
      ) : readable === false ? (
        <EmptyState
          title="Sign in to see earnings"
          action={
            <Link href="/login" className={buttonStyles("primary", "md")}>
              Sign in
            </Link>
          }
        >
          Settlements list what each provider is owed, so the coordinator shows them only to signed-in accounts.
        </EmptyState>
      ) : error ? (
        <ErrorState title="Couldn't load earnings" detail={`${error} Nothing is shown rather than a stale or partial total.`} onRetry={() => load()} />
      ) : !ledger ? (
        <LoadingState waitingFor="settlements from the coordinator" />
      ) : (
        <>
          <p
            className={cx(
              "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-ink",
              ledger.coverage.complete ? "border-line bg-surface" : "border-warning bg-surface-2",
            )}
            role="status"
          >
            <StatusIcon tone={ledger.coverage.complete ? "good" : "warning"} />
            {ledger.coverage.complete && ledger.rows.length === 0 ? (
              <span>The coordinator has no settlements yet.</span>
            ) : ledger.coverage.complete ? (
              <span>
                All {ledger.rows.length} settlement{ledger.rows.length === 1 ? "" : "s"} the coordinator has
                {ledger.coverage.pages > 1 ? ` (read in ${ledger.coverage.pages} pages)` : ""}.
              </span>
            ) : (
              <span>
                <b className="font-semibold">Limited history: showing {ledger.rows.length} settlements.</b> {ledger.coverage.reason} Totals cover only these rows.
              </span>
            )}
            <span className="text-ink-2">
              Source <code className="font-mono">{ledger.coverage.route}</code>
            </span>
          </p>

          {ledger.rows.length === 0 ? (
            <EmptyState title="No settlements yet">
              A row appears when a job ends and the coordinator builds its verdict. Run a job to the end, then refresh.
            </EmptyState>
          ) : (
            t && (
              <>
                <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { k: "Proposed", v: money(t.proposed), note: `${t.byStage.proposed} job(s). Signed or signing verdicts, not finalized.`, tone: "warning" as Tone },
                    { k: "Reported finalized", v: money(t.reported), note: `${t.byStage.reported} job(s). Coordinator recorded a finalize tx. Not checked on-chain.`, tone: "neutral" as Tone },
                    { k: "Credited on-chain", v: null, note: "Needs the escrow's final split (getJob) read from the chain. Not available yet.", tone: "idle" as Tone },
                    { k: "Withdrawn", v: null, note: "The escrow logs withdrawals per wallet, not per job. Needs a chain read. Not available yet.", tone: "idle" as Tone },
                  ].map((s) => (
                    <div key={s.k} className="panel rounded-2xl border border-line p-4">
                      <div className="flex items-center gap-2 text-sm text-ink-2">
                        <StatusIcon tone={s.tone} /> {s.k}
                      </div>
                      <div className="tabular mt-1 text-2xl font-semibold text-ink">
                        {s.v ?? <span className="text-lg font-normal italic text-muted">not checked</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted">{s.note}</p>
                    </div>
                  ))}
                </section>
                {(t.disputed > 0 || t.byStage.error > 0 || t.noVerdict > 0) && (
                  <ul className="space-y-1 text-sm text-ink">
                    {t.disputed > 0 && (
                      <li className="flex items-center gap-2">
                        <StatusIcon tone="serious" /> {money(t.disputed)} sits in {t.byStage.disputed} disputed job(s), left out of both totals: the arbiter can change that split.
                      </li>
                    )}
                    {t.byStage.error > 0 && (
                      <li className="flex items-center gap-2">
                        <StatusIcon tone="critical" /> {t.byStage.error} settlement(s) hit an error. Their status may be stale.
                      </li>
                    )}
                    {t.noVerdict > 0 && (
                      <li className="flex items-center gap-2">
                        <StatusIcon tone="idle" /> {t.noVerdict} row(s) have no readable verdict and add nothing.
                      </li>
                    )}
                  </ul>
                )}

                <Panel title="By provider wallet" subtitle="Addresses from the verdicts. Amounts are the coordinator's, per stage.">
                  <ul className="divide-y divide-line text-sm sm:hidden">
                    {t.payees.map((p) => (
                      <li key={p.address} className="space-y-1 py-3">
                        <code className="block font-mono text-ink [overflow-wrap:anywhere]">{p.address}</code>
                        <p className="tabular text-ink-2">
                          Proposed {money(p.proposed)} · Reported {money(p.reported)}
                          {p.disputed > 0 && ` · Disputed ${money(p.disputed)}`} · {p.jobs} job(s)
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
                    <table className="tabular w-full min-w-[640px] text-left text-sm">
                      <thead className="text-muted">
                        <tr className="border-b border-line">
                          <th className="py-2 pr-4 font-medium">Wallet</th>
                          <th className="py-2 pr-4 text-right font-medium">Proposed</th>
                          <th className="py-2 pr-4 text-right font-medium">Reported finalized</th>
                          <th className="py-2 pr-4 text-right font-medium">Disputed</th>
                          <th className="py-2 pr-4 text-right font-medium">Credited / withdrawn</th>
                          <th className="py-2 text-right font-medium">Jobs</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink">
                        {t.payees.map((p) => (
                          <tr key={p.address} className="border-b border-line">
                            <td className="py-2.5 pr-4"><code className="font-mono" title={p.address}>{short(p.address)}</code></td>
                            <td className="py-2.5 pr-4 text-right">{money(p.proposed)}</td>
                            <td className="py-2.5 pr-4 text-right">{money(p.reported)}</td>
                            <td className="py-2.5 pr-4 text-right">{p.disputed ? money(p.disputed) : "–"}</td>
                            <td className="py-2.5 pr-4 text-right italic text-muted">not checked</td>
                            <td className="py-2.5 text-right">{p.jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="Settlements" subtitle="Newest first, as the coordinator returned them. Download a receipt per job.">
                  <ul className="divide-y divide-line text-sm lg:hidden">
                    {ledger.rows.map((r) => {
                      const st = stageOf(r);
                      return (
                        <li key={r.job_id} className="space-y-2 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <code className="font-mono text-ink">{r.job_id}</code>
                            <StatusPill tone={stageTone[st]}>{stageShort[st]}</StatusPill>
                          </div>
                          <Amounts row={r} />
                          <p className="text-xs text-ink-2">
                            Coordinator status <code className="font-mono">{r.status}</code> · finalize tx <Tx hash={r.finalize_tx} />
                          </p>
                          <Receipt row={r} />
                        </li>
                      );
                    })}
                  </ul>
                  <div className="-mx-5 hidden overflow-x-auto px-5 lg:block">
                    <table className="w-full min-w-[880px] text-left text-sm">
                      <thead className="text-muted">
                        <tr className="border-b border-line">
                          <th className="py-2 pr-4 font-medium">Job</th>
                          <th className="py-2 pr-4 font-medium">Stage</th>
                          <th className="py-2 pr-4 font-medium">Verdict amounts</th>
                          <th className="py-2 pr-4 font-medium">Coordinator status</th>
                          <th className="py-2 pr-4 font-medium">Finalize tx</th>
                          <th className="py-2 font-medium">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="align-top text-ink">
                        {ledger.rows.map((r) => {
                          const st = stageOf(r);
                          return (
                            <tr key={r.job_id} className="border-b border-line">
                              <td className="py-3 pr-4"><code className="font-mono">{r.job_id}</code></td>
                              <td className="py-3 pr-4">
                                <span title={stageText[st]}><StatusPill tone={stageTone[st]}>{stageShort[st]}</StatusPill></span>
                              </td>
                              <td className="py-3 pr-4"><Amounts row={r} /></td>
                              <td className="py-3 pr-4"><code className="font-mono text-ink-2">{r.status}</code></td>
                              <td className="py-3 pr-4"><Tx hash={r.finalize_tx} /></td>
                              <td className="py-3"><Receipt row={r} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )
          )}

          <Panel title="What a receipt can and can't prove">
            <ul className="space-y-1.5 text-sm text-ink">
              {RECEIPT_LIMITS.map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <StatusIcon tone="idle" className="mt-0.5" /> {l}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-2">
              The <Link href="/verify" className="underline underline-offset-2">Verify</Link> screen re-checks one job&apos;s split from the
              chain transaction, but the checkpoints and provider details it checks against still come from the coordinator.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
