"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
// Short stage names are in messages (demo.earnings.stage.<stage>).

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
  const t = useTranslations("demo.earnings");
  if (!hash) return <span className="text-muted">{t("none")}</span>;
  return config.explorer ? (
    <a className="font-mono underline decoration-line-strong underline-offset-2 hover:text-ink" href={`${config.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
      {short(hash)}
    </a>
  ) : (
    <code className="font-mono" title={hash}>{short(hash)}</code>
  );
}

function Receipt({ row }: { row: SettlementRow }) {
  const t = useTranslations("demo.earnings");
  const stamp = () => new Date().toISOString();
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        className={buttonStyles("ghost", "sm")}
        onClick={() => download(`receipt-${row.job_id}.csv`, "text/csv", receiptCsv(row, stamp()))}
        aria-label={t("csvAria", { job: row.job_id })}
      >
        <Download className="size-3.5" aria-hidden /> CSV
      </button>
      <button
        type="button"
        className={buttonStyles("ghost", "sm")}
        onClick={() => download(`receipt-${row.job_id}.json`, "application/json", receiptJson(row, stamp()))}
        aria-label={t("jsonAria", { job: row.job_id })}
      >
        <Download className="size-3.5" aria-hidden /> JSON
      </button>
    </div>
  );
}

function Amounts({ row }: { row: SettlementRow }) {
  const t = useTranslations("demo.earnings");
  if (!row.verdict) return <span className="italic text-muted">{t("noVerdict")}</span>;
  return (
    <ul className="space-y-0.5">
      {row.verdict.payees.map((p, i) => (
        <li key={p} className="tabular">
          <code className="font-mono text-ink-2" title={p}>{short(p)}</code> {money(row.verdict!.amounts[i])}
        </li>
      ))}
      <li className="tabular text-ink-2">{t("refund", { amount: money(row.verdict.refund) })}</li>
    </ul>
  );
}

export default function EarningsPage() {
  const t = useTranslations("demo.earnings");
  const { mode } = useDashboard();
  const { setMode } = useSourceControl();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);
  // Settlements are private (operator only) on a public server: the page says so, and asks for nothing that would only
  // be refused (ekido-ai/ekido-internal#93).
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
            ? t("unreachable", { url: config.coordinatorUrl })
            : e instanceof Error
              ? e.message
              : t("requestFailed"),
        );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, nonce, readable, t]);

  const load = () => {
    setBusy(true);
    setError(null);
    setNonce((n) => n + 1);
  };

  const tot = ledger ? totals(ledger.rows) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        aside={
          mode === "live" && readable === true && (
            <Button size="sm" onClick={() => load()} disabled={busy}>
              <RefreshCw className={cx("size-3.5", busy && "animate-spin motion-reduce:animate-none")} aria-hidden /> {t("refresh")}
            </Button>
          )
        }
      >
        {t("lead")}
      </PageHeader>

      {mode !== "live" ? (
        <EmptyState
          title={t("recordingTitle")}
          action={
            <button type="button" onClick={() => setMode("live")} className={buttonStyles("secondary", "md")}>
              <Radio className="size-4" aria-hidden /> {t("switchToLive")}
            </button>
          }
        >
          {t.rich("recording", { link: (c) => <Link href="/settlement" className="underline underline-offset-2">{c}</Link> })}
        </EmptyState>
      ) : readable === false ? (
        <EmptyState
          title={t("privateTitle")}
          action={
            <Link href="/account" className={buttonStyles("secondary", "md")}>
              {t("yourAccount")}
            </Link>
          }
        >
          {t("private")}
        </EmptyState>
      ) : error ? (
        <ErrorState title={t("loadFailed")} detail={t("loadFailedDetail", { error })} onRetry={() => load()} />
      ) : !ledger ? (
        <LoadingState waitingFor={t("waitingFor")} />
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
              <span>{t("noneYet")}</span>
            ) : ledger.coverage.complete ? (
              <span>
                {t("all", { n: ledger.rows.length })}
                {ledger.coverage.pages > 1 ? t("pages", { n: ledger.coverage.pages }) : ""}.
              </span>
            ) : (
              <span>
                {t.rich("limited", { n: ledger.rows.length, reason: ledger.coverage.reason ?? "", b: (c) => <b className="font-semibold">{c}</b> })}
              </span>
            )}
            <span className="text-ink-2">
              {t.rich("source", { route: ledger.coverage.route, code: (c) => <code className="font-mono">{c}</code> })}
            </span>
          </p>

          {ledger.rows.length === 0 ? (
            <EmptyState title={t("emptyTitle")}>
              {t("empty")}
            </EmptyState>
          ) : (
            tot && (
              <>
                <section aria-label={t("totalsAria")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { k: t("stage.proposed"), v: money(tot.proposed), note: t("proposedNote", { n: tot.byStage.proposed }), tone: "warning" as Tone },
                    { k: t("stage.reported"), v: money(tot.reported), note: t("reportedNote", { n: tot.byStage.reported }), tone: "neutral" as Tone },
                    { k: t("credited"), v: null, note: t("creditedNote"), tone: "idle" as Tone },
                    { k: t("withdrawn"), v: null, note: t("withdrawnNote"), tone: "idle" as Tone },
                  ].map((s) => (
                    <div key={s.k} className="panel rounded-2xl border border-line p-4">
                      <div className="flex items-center gap-2 text-sm text-ink-2">
                        <StatusIcon tone={s.tone} /> {s.k}
                      </div>
                      <div className="tabular mt-1 text-2xl font-semibold text-ink">
                        {s.v ?? <span className="text-lg font-normal italic text-muted">{t("notChecked")}</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted">{s.note}</p>
                    </div>
                  ))}
                </section>
                {(tot.disputed > 0 || tot.byStage.error > 0 || tot.noVerdict > 0) && (
                  <ul className="space-y-1 text-sm text-ink">
                    {tot.disputed > 0 && (
                      <li className="flex items-center gap-2">
                        <StatusIcon tone="serious" /> {t("disputedLine", { amount: money(tot.disputed), n: tot.byStage.disputed })}
                      </li>
                    )}
                    {tot.byStage.error > 0 && (
                      <li className="flex items-center gap-2">
                        <StatusIcon tone="critical" /> {t("errorLine", { n: tot.byStage.error })}
                      </li>
                    )}
                    {tot.noVerdict > 0 && (
                      <li className="flex items-center gap-2">
                        <StatusIcon tone="idle" /> {t("noVerdictLine", { n: tot.noVerdict })}
                      </li>
                    )}
                  </ul>
                )}

                <Panel title={t("byWallet")} subtitle={t("byWalletSubtitle")}>
                  <ul className="divide-y divide-line text-sm sm:hidden">
                    {tot.payees.map((p) => (
                      <li key={p.address} className="space-y-1 py-3">
                        <code className="block font-mono text-ink [overflow-wrap:anywhere]">{p.address}</code>
                        <p className="tabular text-ink-2">
                          {t("walletLine", { proposed: money(p.proposed), reported: money(p.reported) })}
                          {p.disputed > 0 && t("walletDisputed", { amount: money(p.disputed) })}
                          {t("jobs", { n: p.jobs })}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
                    <table className="tabular w-full min-w-[640px] text-left text-sm">
                      <thead className="text-muted">
                        <tr className="border-b border-line">
                          <th className="py-2 pr-4 font-medium">{t("colWallet")}</th>
                          <th className="py-2 pr-4 text-right font-medium">{t("stage.proposed")}</th>
                          <th className="py-2 pr-4 text-right font-medium">{t("stage.reported")}</th>
                          <th className="py-2 pr-4 text-right font-medium">{t("stage.disputed")}</th>
                          <th className="py-2 pr-4 text-right font-medium">{t("colCredited")}</th>
                          <th className="py-2 text-right font-medium">{t("colJobs")}</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink">
                        {tot.payees.map((p) => (
                          <tr key={p.address} className="border-b border-line">
                            <td className="py-2.5 pr-4"><code className="font-mono" title={p.address}>{short(p.address)}</code></td>
                            <td className="py-2.5 pr-4 text-right">{money(p.proposed)}</td>
                            <td className="py-2.5 pr-4 text-right">{money(p.reported)}</td>
                            <td className="py-2.5 pr-4 text-right">{p.disputed ? money(p.disputed) : "–"}</td>
                            <td className="py-2.5 pr-4 text-right italic text-muted">{t("notChecked")}</td>
                            <td className="py-2.5 text-right">{p.jobs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title={t("settlements")} subtitle={t("settlementsSubtitle")}>
                  <ul className="divide-y divide-line text-sm lg:hidden">
                    {ledger.rows.map((r) => {
                      const st = stageOf(r);
                      return (
                        <li key={r.job_id} className="space-y-2 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <code className="font-mono text-ink">{r.job_id}</code>
                            <StatusPill tone={stageTone[st]}>{t(`stage.${st}`)}</StatusPill>
                          </div>
                          <Amounts row={r} />
                          <p className="text-xs text-ink-2">
                            {t.rich("statusLine", { status: r.status, code: (c) => <code className="font-mono">{c}</code> })} <Tx hash={r.finalize_tx} />
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
                          <th className="py-2 pr-4 font-medium">{t("colJob")}</th>
                          <th className="py-2 pr-4 font-medium">{t("colStage")}</th>
                          <th className="py-2 pr-4 font-medium">{t("colAmounts")}</th>
                          <th className="py-2 pr-4 font-medium">{t("colStatus")}</th>
                          <th className="py-2 pr-4 font-medium">{t("colFinalize")}</th>
                          <th className="py-2 font-medium">{t("colReceipt")}</th>
                        </tr>
                      </thead>
                      <tbody className="align-top text-ink">
                        {ledger.rows.map((r) => {
                          const st = stageOf(r);
                          return (
                            <tr key={r.job_id} className="border-b border-line">
                              <td className="py-3 pr-4"><code className="font-mono">{r.job_id}</code></td>
                              <td className="py-3 pr-4">
                                <span title={stageText[st]}><StatusPill tone={stageTone[st]}>{t(`stage.${st}`)}</StatusPill></span>
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

          <Panel title={t("limitsTitle")}>
            <ul className="space-y-1.5 text-sm text-ink">
              {RECEIPT_LIMITS.map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <StatusIcon tone="idle" className="mt-0.5" /> {l}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-2">
              {t.rich("verifyNote", { link: (c) => <Link href="/verify" className="underline underline-offset-2">{c}</Link> })}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
