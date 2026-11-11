"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Download, ExternalLink, FileCheck2, Landmark, Lock, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
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

const scan = (kind: "address" | "tx" | "block", value: string) => `${BASE_SEPOLIA.explorer}/${kind}/${value}`;
const eth = (wei: bigint) => {
  const s = (Number(wei) / 1e18).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
  return s === "0" ? "0" : s;
};
const when = (ms: number | undefined) => (ms ? new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "unknown time");

const EVENT_TEXT: Record<EscrowEvent["kind"], string> = {
  created: "Budget locked in escrow",
  activated: "Coordinator started the job",
  anchor: "Recovery hash anchored",
  attested: "2 of 3 verifiers signed the verdict",
  disputed: "Client disputed with a bond",
  resolved: "Arbiter resolved the dispute",
  settled: "Dispute window closed, split finalized",
  refunded: "Client refunded",
  cancelled: "Client cancelled",
  withdrawal: "Withdrawn",
};

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
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      setLedger(await readLedger((done, total) => setProgress([done, total])));
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "The chain could not be read.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="On-chain ledger"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={ledger ? "good" : error ? "critical" : "active"} size="lg">
              {ledger ? `${BASE_SEPOLIA.name} · block ${ledger.block.toLocaleString("en-US")}` : error ? "Chain unreachable" : "Reading the chain"}
            </StatusPill>
            <Button onClick={load} disabled={busy} aria-label="Read the chain again">
              <RefreshCw className={cx("size-4", busy && "animate-spin")} aria-hidden />
              Read again
            </Button>
          </div>
        }
      >
        Your browser reads this page straight from {BASE_SEPOLIA.name} (chain {BASE_SEPOLIA.chainId}). It never asks our coordinator. The money is test USDC
        held by our escrow contract, and anyone can check the same numbers on Basescan.
      </PageHeader>

      {error && !ledger && (
        <ErrorState title="Couldn't read Base Sepolia" detail={`${error} Public RPCs sometimes limit requests, so wait a moment and try again.`} onRetry={load} />
      )}

      {!ledger && !error && (
        <Panel>
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="text-ink-2">
              Reading the escrow&apos;s history from its deploy block, 50,000 blocks at a time
              {progress ? `: ${progress[0]} of ${progress[1]} ranges` : "…"}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${progress ? (progress[0] / progress[1]) * 100 : 4}%` }} />
            </div>
          </div>
        </Panel>
      )}

      {ledger && <LedgerView ledger={ledger} />}
    </div>
  );
}

function LedgerView({ ledger }: { ledger: Ledger }) {
  const { reserves: r, counters, roles, book } = ledger;
  const clients = new Set(ledger.jobs.map((j) => j.split.client.toLowerCase()));
  const owedProviders = [...ledger.withdrawableOf].filter(([a]) => !clients.has(a)).reduce((s, [, v]) => s + v, BigInt(0));
  const owedClients = counters.totalWithdrawable - owedProviders;
  const parts = [
    { key: "locked", label: "Locked in running jobs", value: counters.totalLocked, cls: "bg-series-1" },
    { key: "prov", label: "Owed to providers", value: owedProviders, cls: "bg-series-3" },
    { key: "cli", label: "Owed back to clients", value: owedClients, cls: "bg-series-4" },
    { key: "surplus", label: "Not owed to anyone", value: r.surplus > BigInt(0) ? r.surplus : BigInt(0), cls: "bg-surface-3" },
  ].filter((p) => p.value > BigInt(0));
  const totalGas = [...ledger.costs.values()].reduce((s, c) => s + c.feeWei, BigInt(0));
  const allPassed = ledger.checks.every((c) => c.passed);

  function downloadCsv() {
    const csv = journalCsv(book.entries.map((e) => ({ ...e, time: when(ledger.times.get(e.block.toString())) })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gpuchain-escrow-journal-block-${ledger.block}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Proof of reserves: the one thing a finance reader checks first. */}
      <section id="reserves" className="grid scroll-mt-24 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Proof of reserves"
          subtitle="What the escrow holds, against everything it has promised to pay"
          actions={<StatusPill tone={r.solvent ? "good" : "critical"}>{r.solvent ? "Fully covered" : "Short"}</StatusPill>}
        >
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <div className="text-sm text-ink-2">USDC held by the escrow</div>
              <div className="font-serif text-5xl text-trust trust-glow"><AnimatedNumber value={Number(r.held) / 1e6} format={(n) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} /></div>
              <div className="mt-1 text-xs text-muted">USDC.balanceOf(escrow)</div>
            </div>
            <div>
              <div className="text-sm text-ink-2">Locked or owed</div>
              <div className="font-serif text-5xl text-ink"><AnimatedNumber value={Number(r.liabilities) / 1e6} format={(n) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} /></div>
              <div className="mt-1 text-xs text-muted">totalLocked() + totalWithdrawable()</div>
            </div>
            <div>
              <div className="text-sm text-ink-2">Coverage</div>
              <div className="font-serif text-5xl text-ink"><AnimatedNumber value={r.coverageBps / 100} format={(n) => `${n.toFixed(r.coverageBps % 100 ? 2 : 0)}%`} /></div>
              <div className="mt-1 text-xs text-muted">Read at block {ledger.block.toLocaleString("en-US")}</div>
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
            Money leaves only when the person it&apos;s owed to calls <code className="font-mono text-xs">withdraw()</code>. Nobody else can move it, us included.
          </p>
        </Panel>

        <Panel title="The contracts" subtitle="Deployed on Base Sepolia on 7 Nov 2026">
          <dl className="space-y-3 text-sm">
            {[
              { k: "Escrow", v: BASE_SEPOLIA.escrow, d: "Holds budgets, checks verifier signatures, pays out" },
              { k: "Provider registry", v: BASE_SEPOLIA.registry, d: "Public sign-up for providers, holds no money" },
              { k: "Token", v: BASE_SEPOLIA.usdc, d: "Circle's test USDC, 6 decimals" },
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
            Unaudited and testnet only. It enforces who gets paid. It does not prove the training happened, which is the Quality Guard&apos;s job.
          </p>
        </Panel>
      </section>

      <Panel
        title="Reconciliation"
        subtitle={`Three independent sources must agree: the replayed events, the contract's own totals, and each wallet's balance. ${ledger.source === "index" ? "Event history came from our index in one request and passed these checks; if it hadn't, your browser would have scanned the chain itself." : "Event history was scanned straight from the chain."}`}
        actions={<StatusPill tone={allPassed ? "good" : "critical"}>{allPassed ? `${ledger.checks.length} of ${ledger.checks.length} agree` : "Mismatch found"}</StatusPill>}
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

      <RegistryPanel ledger={ledger} />

      <section className="space-y-4" aria-labelledby="jobs-h">
        <h2 id="jobs-h" className="font-serif text-2xl text-ink">
          Jobs on the chain <span className="text-base font-normal text-ink-2">({ledger.jobs.length})</span>
        </h2>
        {ledger.jobs.length === 0 && <p className="text-ink-2">No job has been funded on this escrow yet.</p>}
        {ledger.jobs.map((job) => {
          const s = job.split;
          const gas = [...new Set(job.events.map((e) => e.tx.toLowerCase()))].reduce((sum, t) => sum + (ledger.costs.get(t)?.feeWei ?? BigInt(0)), BigInt(0));
          const paid = s.amounts.reduce((a, b) => a + b, BigInt(0));
          return (
            <Panel
              key={job.jobId}
              title={<span className="font-mono">Job {short(job.jobId)}</span>}
              subtitle={`${usdc(s.budget)} USDC budget · state ${STATES[s.state] ?? s.state} · settlement gas ${eth(gas)} ETH`}
              actions={<StatusPill tone={STATES[s.state] === "Settled" ? "good" : STATES[s.state] === "Refunded" ? "neutral" : "active"}>{STATES[s.state]}</StatusPill>}
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-ink">Where the money went</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <div className="text-xs text-muted">Client</div>
                      <Addr value={s.client} />
                    </div>
                    <ArrowRight className="size-4 text-muted" aria-hidden />
                    <div className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
                      <div className="flex items-center gap-1 text-xs text-muted"><Lock className="size-3" aria-hidden />Escrow</div>
                      <div className="font-semibold text-ink tabular">{usdc(s.budget)} USDC</div>
                    </div>
                    <ArrowRight className="size-4 text-muted" aria-hidden />
                    <ul className="space-y-1.5">
                      {s.payees.map((p, i) => (
                        <li key={p} className="flex items-center gap-2">
                          <span className="size-2.5 rounded-sm bg-series-3" aria-hidden />
                          <Addr value={p} /> <span className="font-semibold text-ink tabular">{usdc(s.amounts[i])}</span>
                          <span className="text-ink-2">for accepted steps</span>
                        </li>
                      ))}
                      {s.refund > BigInt(0) && (
                        <li className="flex items-center gap-2">
                          <span className="size-2.5 rounded-sm bg-series-4" aria-hidden />
                          <span className="text-ink-2">Client refund</span> <span className="font-semibold text-ink tabular">{usdc(s.refund)}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                  <p className="mt-3 text-sm text-ink-2">
                    {usdc(paid)} paid + {usdc(s.refund)} refunded = {usdc(paid + s.refund)} USDC, the whole budget. The contract rejects any split that doesn&apos;t add up.
                  </p>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-ink">Every step, as recorded on-chain</h3>
                  <ol className="relative space-y-3 border-l border-line pl-5">
                    {job.events.map((e) => (
                      <li key={`${e.tx}-${e.logIndex}`} className="relative">
                        <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-bg bg-ink" aria-hidden />
                        <div className="text-sm font-medium text-ink">{EVENT_TEXT[e.kind]}</div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                          <span>{when(ledger.times.get(e.block.toString()))}</span>
                          <a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href={scan("block", e.block.toString())} target="_blank" rel="noreferrer">
                            block {e.block.toLocaleString("en-US")}
                          </a>
                          <Tx hash={e.tx} />
                          {ledger.costs.get(e.tx.toLowerCase()) && <span>{ledger.costs.get(e.tx.toLowerCase())!.gasUsed.toLocaleString("en-US")} gas</span>}
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
        title="Journal"
        subtitle="Double-entry: each row moves one amount from one account to another, so the books always balance"
        actions={
          <Button size="sm" onClick={downloadCsv}>
            <Download className="size-4" aria-hidden />
            Download CSV
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 text-right font-medium">USDC</th>
                <th className="px-5 py-2 font-medium">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {book.entries.map((e) => (
                <tr key={`${e.tx}-${e.logIndex}-${e.debit}`} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-5 py-2 text-ink-2">{when(ledger.times.get(e.block.toString()))}</td>
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
        <Panel title="Waiting to be withdrawn" subtitle="Each balance read one by one from withdrawable(address)">
          {ledger.withdrawableOf.size === 0 ? (
            <p className="text-ink-2">Nothing is owed. Every credit has been withdrawn.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...ledger.withdrawableOf].map(([a, v]) => (
                <li key={a} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2">
                    <Wallet className="size-4 text-muted" aria-hidden />
                    <Addr value={a} />
                    <span className="text-xs text-muted">{clients.has(a) ? "client refund" : "provider earnings"}</span>
                  </span>
                  <span className="font-semibold text-ink tabular">{usdc(v)} USDC</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-ink-2">
            Network fees for all {ledger.costs.size} escrow transactions so far: <span className="font-semibold text-ink">{eth(totalGas)} ETH</span> at testnet gas prices.
          </p>
        </Panel>
        <WalletCheck />
      </section>

      <Panel title="Who can do what" subtitle="Read from the contract now. These powers are written into the code and can't be stretched">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Role icon={ShieldCheck} name={`Verifiers, ${roles.quorum} of ${roles.verifiers.length} must sign`} can="Sign the quality verdict and the payout split" cannot="Pay anyone alone, or reuse a verdict on another job or chain">
            <div className="flex flex-col gap-1">{roles.verifiers.map((v) => <Addr key={v} value={v} />)}</div>
          </Role>
          <Role icon={Landmark} name="Coordinator" can="Start a funded job and anchor recovery hashes" cannot="Move any money. A refund opens to anyone once the deadline passes">
            <Addr value={roles.coordinator} />
          </Role>
          <Role icon={FileCheck2} name="Arbiter" can={`Decide a dispute, where the client posts a ${usdc(roles.bond)} USDC bond`} cannot="Act on undisputed jobs. If silent for 3 days, the verdict stands and the bond goes back">
            <Addr value={roles.arbiter} />
          </Role>
          <Role icon={Lock} name="Owner" can="Name a new verifier set or arbiter for future jobs" cannot="Change the rules of a job already funded. Each job keeps the set it started with">
            <Addr value={roles.owner} />
          </Role>
        </div>
        <p className="mt-4 text-sm text-ink-2">
          All four roles are run by our team today, so this is a permissioned system, not a trustless one. What the chain adds is that the rules are public and money only moves the way they allow.
        </p>
      </Panel>
    </>
  );
}

function RegistryPanel({ ledger }: { ledger: Ledger }) {
  const [coord, setCoord] = useState<CoordinatorProvider[] | null | "down">(null);
  useEffect(() => {
    fetch(`${config.coordinatorUrl}/providers`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: CoordinatorProvider[]) => setCoord(rows))
      .catch(() => setCoord("down"));
  }, []);
  const { listings, offChainOnly } = compareListings(ledger.registry, Array.isArray(coord) ? coord : null);
  const label = { matches: "Coordinator shows exactly these terms", differs: "Coordinator shows different terms", "not-listed": "Not listed by the coordinator" } as const;
  const tone = { matches: "good", differs: "critical", "not-listed": "warning" } as const;
  return (
    <Panel
      title="Providers, as they committed themselves"
      subtitle="Each provider's own wallet registered a hash of its name, price and memory in ProviderRegistry. Your browser recomputes that hash from what our coordinator publishes."
      actions={<StatusPill tone="neutral">{ledger.registry.length} on-chain</StatusPill>}
    >
      {ledger.registry.length === 0 ? (
        <p className="text-ink-2">
          No provider has listed on-chain yet. The provider kit does it automatically when the wallet has a little test ETH for gas.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((l) => (
            <li key={l.wallet} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2">
                <StatusIcon tone={coord === "down" || coord === null ? "idle" : tone[l.status]} className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{l.coordinatorName ?? "Unknown name"}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <Addr value={l.wallet} />
                    <Tx hash={l.tx} />
                    {l.updates > 0 && <span>updated {l.updates}×</span>}
                  </span>
                </span>
              </span>
              <span className="text-sm text-ink-2">{coord === "down" ? "Coordinator unreachable, can't compare" : coord === null ? "Comparing…" : label[l.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(coord) && (
        <p className="mt-4 text-sm text-ink-2">
          {offChainOnly === 0 ? "Every provider the coordinator lists has also committed on-chain." : `${offChainOnly} provider${offChainOnly === 1 ? "" : "s"} the coordinator lists ${offChainOnly === 1 ? "hasn't" : "haven't"} committed on-chain yet, so only our word stands behind ${offChainOnly === 1 ? "its" : "their"} terms.`}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        A listing proves the provider chose these terms. It says nothing about its hardware, which stays self-reported.
      </p>
    </Panel>
  );
}

function Account({ id, clients }: { id: string; clients: Set<string> }) {
  const [kind, value] = id.split(":") as [string, string];
  if (kind === "locked") return <span className="inline-flex items-center gap-1 text-ink-2"><Lock className="size-3" aria-hidden />Escrow, job {short(value)}</span>;
  const who = clients.has(value) ? "client" : "provider";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-ink-2">
      {kind === "owed" ? `Owed to ${who}` : `${who[0].toUpperCase()}${who.slice(1)} wallet`}
      <Addr value={value} />
    </span>
  );
}

function Role({ icon: Icon, name, can, cannot, children }: { icon: typeof Lock; name: string; can: string; cannot: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-2 font-semibold text-ink"><Icon className="size-4" aria-hidden />{name}</div>
      <div className="mt-2">{children}</div>
      <p className="mt-3 text-sm text-ink"><span className="text-good">Can:</span> {can}</p>
      <p className="mt-1 text-sm text-ink-2"><span className="text-critical">Can&apos;t:</span> {cannot}</p>
    </div>
  );
}

function WalletCheck() {
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
      setError(err instanceof Error ? err.message.split("\n")[0] : "The wallet couldn't be read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Check any wallet" subtitle="A provider can see what they're owed without asking us">
      <form onSubmit={check} className="flex flex-wrap gap-2">
        <label htmlFor="wallet-check" className="sr-only">Wallet address</label>
        <input
          id="wallet-check"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x… wallet address"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 font-mono text-sm text-ink placeholder:text-muted"
        />
        <Button type="submit" variant="primary" disabled={!valid || busy}>{busy ? "Reading" : "Check wallet"}</Button>
      </form>
      {value && !valid && <p className="mt-2 text-sm text-ink-2">Enter a full address: 0x and 40 hex characters.</p>}
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
      {result && (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
          <div><dt className="text-ink-2">Owed by the escrow</dt><dd className="text-xl font-semibold text-ink tabular">{usdc(result.owed)} <span className="text-sm font-normal text-ink-2">USDC</span></dd></div>
          <div><dt className="text-ink-2">USDC in the wallet</dt><dd className="text-xl font-semibold text-ink tabular">{usdc(result.usdc)}</dd></div>
          <div><dt className="text-ink-2">ETH for gas</dt><dd className="text-xl font-semibold text-ink tabular">{eth(result.eth)}</dd></div>
        </dl>
      )}
      <p className="mt-4 text-xs text-muted">Nothing is signed or sent. The address is only used for these three reads.</p>
    </Panel>
  );
}

