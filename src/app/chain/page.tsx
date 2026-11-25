"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Download, ExternalLink, FileCheck2, Landmark, Lock, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { isAddress, type Address } from "viem";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusIcon, StatusPill } from "@/components/ui/status";
import { ErrorState } from "@/components/ui/states";
import { cx } from "@/components/ui/cx";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { BASE_SEPOLIA, STATES, readLedger, readWallet, type Ledger } from "@/lib/chain/read";
import { journalCsv, short, usdc, type EscrowEvent } from "@/lib/chain/ledger";
import { compareListings, type CoordinatorProvider } from "@/lib/chain/registry";
import { config } from "@/lib/config";
import { usePrivateListsReadable } from "@/lib/platform/signed-in";

const scan = (kind: "address" | "tx" | "block", value: string) => `${BASE_SEPOLIA.explorer}/${kind}/${value}`;
const eth = (wei: bigint) => {
  const s = (Number(wei) / 1e18).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
  return s === "0" ? "0" : s;
};
const when = (ms: number | undefined, unknown: string) => (ms ? new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC" : unknown);
// Each escrow event's words are in messages (demo.chain.events.<kind>).
type EventKind = EscrowEvent["kind"];

function Addr({ value, label }: { value: string; label?: string }) {
  return (
    <a href={scan("address", value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" title={value}>
      {label ?? short(value)}
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

function Tx({ hash }: { hash: string }) {
  return (
    <a href={scan("tx", hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink" title={hash}>
      {short(hash)}
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

export default function ChainPage() {
  const t = useTranslations("demo.chain");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  // A local coordinator: read straight away, using its log index. On a public server the index is private (operator
  // only) and reading the whole chain takes ~150 public-RPC calls, so it waits for "Check on chain"
  // (ekido-ai/ekido-internal#93, #94).
  const indexReadable = usePrivateListsReadable();

  const load = useCallback(async () => {
    setStarted(true);
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      setLedger(await readLedger((done, total) => setProgress([done, total]), { useIndex: indexReadable === true }));
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : t("readFallback"));
    } finally {
      setBusy(false);
    }
  }, [indexReadable, t]);

  useEffect(() => {
    if (indexReadable !== true) return;
    // Runs once the answer is known; the state updates inside load() happen after its first await.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [indexReadable, load]);
  // On a public server, until "Check on chain" is pressed.
  const waiting = indexReadable === false && !started;
  const idle = !started && !ledger;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={ledger ? "good" : error ? "critical" : idle ? "neutral" : "active"} size="lg">
              {ledger ? t("statusBlock", { chain: BASE_SEPOLIA.name, block: ledger.block.toLocaleString("en-US") }) : t(error ? "unreachable" : idle ? "notRead" : "reading")}
            </StatusPill>
            {started && (
              <Button onClick={load} disabled={busy} aria-label={t("readAgainAria")}>
                <RefreshCw className={cx("size-4", busy && "animate-spin")} aria-hidden />
                {t("readAgain")}
              </Button>
            )}
          </div>
        }
      >
        {t("lead", { chain: BASE_SEPOLIA.name, id: BASE_SEPOLIA.chainId })}
      </PageHeader>

      {error && !ledger && (
        <ErrorState title={t("errorTitle")} detail={t("errorDetail", { error })} onRetry={load} />
      )}

      {waiting && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-ink-2">
              {t("waiting", { chain: BASE_SEPOLIA.name })}
            </p>
            <Button variant="primary" onClick={load}>
              <ShieldCheck className="size-4" aria-hidden />
              {t("check")}
            </Button>
          </div>
        </Panel>
      )}

      {started && !ledger && !error && (
        <Panel>
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="text-ink-2">
              {t("progress")}
              {progress ? t("progressRanges", { done: progress[0], total: progress[1] }) : "…"}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${progress ? (progress[0] / progress[1]) * 100 : 4}%` }} />
            </div>
          </div>
        </Panel>
      )}

      {ledger && <LedgerView ledger={ledger} coordinatorReadable={indexReadable === true} />}
    </div>
  );
}

function LedgerView({ ledger, coordinatorReadable }: { ledger: Ledger; coordinatorReadable: boolean }) {
  const t = useTranslations("demo.chain");
  const at = (block: bigint) => when(ledger.times.get(block.toString()), t("unknownTime"));
  const { reserves: r, counters, roles, book } = ledger;
  const clients = new Set(ledger.jobs.map((j) => j.split.client.toLowerCase()));
  const owedProviders = [...ledger.withdrawableOf].filter(([a]) => !clients.has(a)).reduce((s, [, v]) => s + v, BigInt(0));
  const owedClients = counters.totalWithdrawable - owedProviders;
  const parts = [
    { key: "locked", label: t("parts.locked"), value: counters.totalLocked, cls: "bg-series-1" },
    { key: "prov", label: t("parts.prov"), value: owedProviders, cls: "bg-series-3" },
    { key: "cli", label: t("parts.cli"), value: owedClients, cls: "bg-series-4" },
    { key: "surplus", label: t("parts.surplus"), value: r.surplus > BigInt(0) ? r.surplus : BigInt(0), cls: "bg-surface-3" },
  ].filter((p) => p.value > BigInt(0));
  const totalGas = [...ledger.costs.values()].reduce((s, c) => s + c.feeWei, BigInt(0));
  const allPassed = ledger.checks.every((c) => c.passed);

  function downloadCsv() {
    const csv = journalCsv(book.entries.map((e) => ({ ...e, time: at(e.block) })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekido-escrow-journal-block-${ledger.block}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Proof of reserves: the one thing a finance reader checks first. */}
      <section id="reserves" className="grid scroll-mt-24 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title={t("reserves")}
          subtitle={t("reservesSubtitle")}
          actions={<StatusPill tone={r.solvent ? "good" : "critical"}>{t(r.solvent ? "covered" : "short")}</StatusPill>}
        >
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="text-sm text-ink-2">{t("held")}</div>
              <div className="font-serif text-5xl text-trust trust-glow"><AnimatedNumber value={Number(r.held) / 1e6} format={(n) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} /></div>
              <div className="mt-1 text-xs text-muted">USDC.balanceOf(escrow)</div>
            </div>
            <div>
              <div className="text-sm text-ink-2">{t("owed")}</div>
              <div className="font-serif text-5xl text-ink"><AnimatedNumber value={Number(r.liabilities) / 1e6} format={(n) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} /></div>
              <div className="mt-1 text-xs text-muted">totalLocked() + totalWithdrawable()</div>
            </div>
            <div>
              <div className="text-sm text-ink-2">{t("coverage")}</div>
              <div className="font-serif text-5xl text-ink"><AnimatedNumber value={r.coverageBps / 100} format={(n) => `${n.toFixed(r.coverageBps % 100 ? 2 : 0)}%`} /></div>
              <div className="mt-1 text-xs text-muted">{t("readAtBlock", { block: ledger.block.toLocaleString("en-US") })}</div>
            </div>
          </div>
          {parts.length > 0 && (
            <div className="mt-6">
              <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-md" role="img" aria-label={parts.map((p) => `${p.label} ${usdc(p.value)} USDC`).join(", ")}>
                {parts.map((p) => (
                  <div key={p.key} className={cx("h-full", p.cls)} style={{ flexGrow: Number(p.value) }} title={`${p.label}: ${usdc(p.value)} USDC`} />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {parts.map((p) => (
                  <li key={p.key} className="flex items-center gap-2 text-ink-2">
                    <span className={cx("size-3 rounded-sm", p.cls)} aria-hidden />
                    {p.label}
                    <span className="font-semibold text-ink tabular">{usdc(p.value)} USDC</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-5 text-sm text-ink-2">
            {t.rich("withdrawOnly", { code: (c) => <code className="font-mono text-xs">{c}</code> })}
          </p>
        </Panel>

        <Panel title={t("contracts")} subtitle={t("contractsSubtitle")}>
          <dl className="space-y-3 text-sm">
            {[
              { k: t("escrow"), v: BASE_SEPOLIA.escrow, d: t("escrowWhat") },
              { k: t("registry"), v: BASE_SEPOLIA.registry, d: t("registryWhat") },
              { k: t("token"), v: BASE_SEPOLIA.usdc, d: t("tokenWhat") },
            ].map((row) => (
              <div key={row.k}>
                <dt className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{row.k}</span>
                  <Addr value={row.v} />
                </dt>
                <dd className="text-ink-2">{row.d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-2">
            {t("unaudited")}
          </p>
        </Panel>
      </section>

      <Panel
        title={t("reconciliation")}
        subtitle={t(ledger.source === "index" ? "reconciliationIndex" : "reconciliationChain")}
        actions={<StatusPill tone={allPassed ? "good" : "critical"}>{allPassed ? t("agree", { n: ledger.checks.length }) : t("mismatch")}</StatusPill>}
      >
        <ul className="divide-y divide-line">
          {ledger.checks.map((c) => (
            <li key={c.title} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <StatusIcon tone={c.passed ? "good" : "critical"} className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-ink">{c.title}</div>
                <div className="text-sm text-ink-2 [overflow-wrap:anywhere]">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <RegistryPanel ledger={ledger} coordinatorReadable={coordinatorReadable} />

      <section className="space-y-4" aria-labelledby="jobs-h">
        <h2 id="jobs-h" className="font-serif text-2xl text-ink">
          {t("jobsTitle")} <span className="text-base font-normal text-ink-2">({ledger.jobs.length})</span>
        </h2>
        {ledger.jobs.length === 0 && <p className="text-ink-2">{t("noJobs")}</p>}
        {ledger.jobs.map((job) => {
          const s = job.split;
          const gas = [...new Set(job.events.map((e) => e.tx.toLowerCase()))].reduce((sum, tx) => sum + (ledger.costs.get(tx)?.feeWei ?? BigInt(0)), BigInt(0));
          const paid = s.amounts.reduce((a, b) => a + b, BigInt(0));
          return (
            <Panel
              key={job.jobId}
              title={<span className="font-mono">{t("job", { id: short(job.jobId) })}</span>}
              subtitle={t("jobSubtitle", { budget: usdc(s.budget), state: STATES[s.state] ?? String(s.state), gas: eth(gas) })}
              actions={<StatusPill tone={STATES[s.state] === "Settled" ? "good" : STATES[s.state] === "Refunded" ? "neutral" : "active"}>{STATES[s.state]}</StatusPill>}
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-ink">{t("whereMoney")}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <div className="text-xs text-muted">{t("client")}</div>
                      <Addr value={s.client} />
                    </div>
                    <ArrowRight className="size-4 text-muted" aria-hidden />
                    <div className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
                      <div className="flex items-center gap-1 text-xs text-muted"><Lock className="size-3" aria-hidden />{t("escrow")}</div>
                      <div className="font-semibold text-ink tabular">{usdc(s.budget)} USDC</div>
                    </div>
                    <ArrowRight className="size-4 text-muted" aria-hidden />
                    <ul className="space-y-1.5">
                      {s.payees.map((p, i) => (
                        <li key={p} className="flex items-center gap-2">
                          <span className="size-2.5 rounded-sm bg-series-3" aria-hidden />
                          <Addr value={p} /> <span className="font-semibold text-ink tabular">{usdc(s.amounts[i])}</span>
                          <span className="text-ink-2">{t("forAccepted")}</span>
                        </li>
                      ))}
                      {s.refund > BigInt(0) && (
                        <li className="flex items-center gap-2">
                          <span className="size-2.5 rounded-sm bg-series-4" aria-hidden />
                          <span className="text-ink-2">{t("clientRefund")}</span> <span className="font-semibold text-ink tabular">{usdc(s.refund)}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                  <p className="mt-3 text-sm text-ink-2">
                    {t("sum", { paid: usdc(paid), refund: usdc(s.refund), total: usdc(paid + s.refund) })}
                  </p>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-ink">{t("everyStep")}</h3>
                  <ol className="relative space-y-3 border-l border-line pl-5">
                    {job.events.map((e) => (
                      <li key={`${e.tx}-${e.logIndex}`} className="relative">
                        <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-bg bg-ink" aria-hidden />
                        <div className="text-sm font-medium text-ink">{t(`events.${e.kind as EventKind}`)}</div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                          <span>{at(e.block)}</span>
                          <a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href={scan("block", e.block.toString())} target="_blank" rel="noreferrer">
                            {t("block", { block: e.block.toLocaleString("en-US") })}
                          </a>
                          <Tx hash={e.tx} />
                          {ledger.costs.get(e.tx.toLowerCase()) && <span>{t("gas", { gas: ledger.costs.get(e.tx.toLowerCase())!.gasUsed.toLocaleString("en-US") })}</span>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Panel>
          );
        })}
      </section>

      <Panel
        title={t("journal")}
        subtitle={t("journalSubtitle")}
        actions={
          <Button size="sm" onClick={downloadCsv}>
            <Download className="size-4" aria-hidden />
            {t("downloadCsv")}
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">{t("colWhen")}</th>
                <th className="px-3 py-2 font-medium">{t("colEntry")}</th>
                <th className="px-3 py-2 font-medium">{t("colFrom")}</th>
                <th className="px-3 py-2 font-medium">{t("colTo")}</th>
                <th className="px-3 py-2 text-right font-medium">USDC</th>
                <th className="px-5 py-2 font-medium">{t("colTx")}</th>
              </tr>
            </thead>
            <tbody>
              {book.entries.map((e) => (
                <tr key={`${e.tx}-${e.logIndex}-${e.debit}`} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-5 py-2 text-ink-2">{at(e.block)}</td>
                  <td className="px-3 py-2 text-ink">{e.memo}</td>
                  <td className="px-3 py-2"><Account id={e.credit} clients={clients} /></td>
                  <td className="px-3 py-2"><Account id={e.debit} clients={clients} /></td>
                  <td className="px-3 py-2 text-right font-semibold text-ink tabular">{usdc(e.amount)}</td>
                  <td className="px-5 py-2"><Tx hash={e.tx} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("waitingWithdraw")} subtitle={t("waitingWithdrawSubtitle")}>
          {ledger.withdrawableOf.size === 0 ? (
            <p className="text-ink-2">{t("nothingOwed")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...ledger.withdrawableOf].map(([a, v]) => (
                <li key={a} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2">
                    <Wallet className="size-4 text-muted" aria-hidden />
                    <Addr value={a} />
                    <span className="text-xs text-muted">{t(clients.has(a) ? "clientRefundKind" : "providerEarningsKind")}</span>
                  </span>
                  <span className="font-semibold text-ink tabular">{usdc(v)} USDC</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-ink-2">
            {t.rich("fees", { n: ledger.costs.size, gas: eth(totalGas), b: (c) => <span className="font-semibold text-ink">{c}</span> })}
          </p>
        </Panel>
        <WalletCheck />
      </section>

      <Panel title={t("roles")} subtitle={t("rolesSubtitle")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Role icon={ShieldCheck} name={t("verifiers", { quorum: String(roles.quorum), total: roles.verifiers.length })} can={t("verifiersCan")} cannot={t("verifiersCannot")}>
            <div className="flex flex-col gap-1">{roles.verifiers.map((v) => <Addr key={v} value={v} />)}</div>
          </Role>
          <Role icon={Landmark} name={t("coordinator")} can={t("coordinatorCan")} cannot={t("coordinatorCannot")}>
            <Addr value={roles.coordinator} />
          </Role>
          <Role icon={FileCheck2} name={t("arbiter")} can={t("arbiterCan", { bond: usdc(roles.bond) })} cannot={t("arbiterCannot")}>
            <Addr value={roles.arbiter} />
          </Role>
          <Role icon={Lock} name={t("owner")} can={t("ownerCan")} cannot={t("ownerCannot")}>
            <Addr value={roles.owner} />
          </Role>
        </div>
        <p className="mt-4 text-sm text-ink-2">
          {t("rolesNote")}
        </p>
      </Panel>
    </>
  );
}

function RegistryPanel({ ledger, coordinatorReadable }: { ledger: Ledger; coordinatorReadable: boolean }) {
  const t = useTranslations("demo.chain");
  const [coord, setCoord] = useState<CoordinatorProvider[] | null | "down" | "private">(coordinatorReadable ? null : "private");
  useEffect(() => {
    // On a public server the list is private (operator only): don't ask for a 401 (ekido-ai/ekido-internal#93).
    if (!coordinatorReadable) return;
    fetch(`${config.coordinatorUrl}/providers`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.status === 401 || r.status === 403 ? "private" : r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: CoordinatorProvider[] | "private") => setCoord(rows))
      .catch(() => setCoord("down"));
  }, [coordinatorReadable]);
  const { listings, offChainOnly } = compareListings(ledger.registry, Array.isArray(coord) ? coord : null);
  const tone = { matches: "good", differs: "critical", "not-listed": "warning" } as const;
  return (
    <Panel
      title={t("providersTitle")}
      subtitle={t("providersSubtitle")}
      actions={<StatusPill tone="neutral">{t("onChain", { n: ledger.registry.length })}</StatusPill>}
    >
      {ledger.registry.length === 0 ? (
        <p className="text-ink-2">
          {t("noProviders")}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((l) => (
            <li key={l.wallet} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2">
                <StatusIcon tone={coord === "down" || coord === "private" || coord === null ? "idle" : tone[l.status]} className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{l.coordinatorName ?? t("unknownName")}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <Addr value={l.wallet} />
                    <Tx hash={l.tx} />
                    {l.updates > 0 && <span>{t("updated", { n: l.updates })}</span>}
                  </span>
                </span>
              </span>
              <span className="text-sm text-ink-2">{coord === "down" ? t("coordDown") : coord === "private" ? t("coordPrivate") : coord === null ? t("comparing") : t(`listing.${l.status}`)}</span>
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(coord) && (
        <p className="mt-4 text-sm text-ink-2">
          {offChainOnly === 0 ? t("allCommitted") : t("notCommitted", { n: offChainOnly })}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        {t("listingNote")}
      </p>
    </Panel>
  );
}

function Account({ id, clients }: { id: string; clients: Set<string> }) {
  const t = useTranslations("demo.chain");
  const [kind, value] = id.split(":") as [string, string];
  if (kind === "locked") return <span className="inline-flex items-center gap-1 text-ink-2"><Lock className="size-3" aria-hidden />{t("escrowJob", { id: short(value) })}</span>;
  const who = clients.has(value) ? "client" : "provider";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-ink-2">
      {t(kind === "owed" ? `owedTo.${who}` : `wallet.${who}`)}
      <Addr value={value} />
    </span>
  );
}

function Role({ icon: Icon, name, can, cannot, children }: { icon: typeof Lock; name: string; can: string; cannot: string; children: React.ReactNode }) {
  const t = useTranslations("demo.chain");
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-2 font-semibold text-ink"><Icon className="size-4" aria-hidden />{name}</div>
      <div className="mt-2">{children}</div>
      <p className="mt-3 text-sm text-ink"><span className="text-good">{t("can")}</span> {can}</p>
      <p className="mt-1 text-sm text-ink-2"><span className="text-critical">{t("cannot")}</span> {cannot}</p>
    </div>
  );
}

function WalletCheck() {
  const t = useTranslations("demo.chain");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<{ usdc: bigint; owed: bigint; eth: bigint } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = isAddress(value.trim());

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await readWallet(value.trim() as Address));
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : t("walletFallback"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={t("walletTitle")} subtitle={t("walletSubtitle")}>
      <form onSubmit={check} className="flex flex-wrap gap-2">
        <label htmlFor="wallet-check" className="sr-only">{t("walletLabel")}</label>
        <input
          id="wallet-check"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("walletPlaceholder")}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 font-mono text-sm text-ink placeholder:text-muted"
        />
        <Button type="submit" variant="primary" disabled={!valid || busy}>{t(busy ? "readingShort" : "checkWallet")}</Button>
      </form>
      {value && !valid && <p className="mt-2 text-sm text-ink-2">{t("walletInvalid")}</p>}
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
      {result && (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
          <div><dt className="text-ink-2">{t("owedByEscrow")}</dt><dd className="text-xl font-semibold text-ink tabular">{usdc(result.owed)} <span className="text-sm font-normal text-ink-2">USDC</span></dd></div>
          <div><dt className="text-ink-2">{t("usdcInWallet")}</dt><dd className="text-xl font-semibold text-ink tabular">{usdc(result.usdc)}</dd></div>
          <div><dt className="text-ink-2">{t("ethForGas")}</dt><dd className="text-xl font-semibold text-ink tabular">{eth(result.eth)}</dd></div>
        </dl>
      )}
      <p className="mt-4 text-xs text-muted">{t("walletNote")}</p>
    </Panel>
  );
}

