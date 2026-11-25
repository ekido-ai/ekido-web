"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusIcon, StatusPill } from "@/components/ui/status";
import { ErrorState } from "@/components/ui/states";
import { WalletButton, useSession } from "@/components/wallet/wallet-button";
import { BASE_SEPOLIA, STATES, readLedger, readWallet, withdrawFromEscrow, type Ledger } from "@/lib/chain/read";
import { journalCsv, owed, short, usdc, wallet as walletAccount } from "@/lib/chain/ledger";
import { compareListings, type CoordinatorProvider } from "@/lib/chain/registry";
import { injectedProvider, friendlyError } from "@/lib/wallet/escrow";
import { viewAs } from "@/lib/wallet/session";
import { config } from "@/lib/config";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Celebrate } from "@/components/motion/celebrate";
import { privateListsReadable } from "@/lib/platform/signed-in";

const scan = (kind: "address" | "tx", v: string) => `${BASE_SEPOLIA.explorer}/${kind}/${v}`;
const eth = (wei: bigint) => (Number(wei) / 1e18).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") || "0";

export default function AccountPage() {
  const session = useSession();
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <PageHeader title="Your account" kicker="ACCOUNT">Sign in with your wallet to see what you&apos;re owed, the jobs you paid for, and your listing as a provider.</PageHeader>
        <Panel>
          <div className="flex flex-col items-start gap-4">
            <WalletButton />
            <DemoButtons />
            <ul className="space-y-2 text-sm text-ink-2">
              <li className="flex gap-2"><KeyRound className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /> No password and no email. Your wallet signs a short message that only proves the address is yours.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /> Signing in costs nothing and can&apos;t move money. Withdrawals ask your wallet again, every time.</li>
              <li className="flex gap-2"><Wallet className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /> Use a test wallet on Base Sepolia. Never a wallet that holds real funds.</li>
            </ul>
          </div>
        </Panel>
      </div>
    );
  }
  return <SignedIn address={session.address} expiresAt={session.expiresAt} demo={session.demo} />;
}

function DemoButtons() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-2">Or look around without a wallet:</span>
      {(["client", "provider"] as const).map((role) => (
        <Button key={role} size="sm" onClick={() => viewAs(role)}>View as a demo {role}</Button>
      ))}
    </div>
  );
}

function SignedIn({ address, expiresAt, demo }: { address: `0x${string}`; expiresAt: number; demo?: string }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [balances, setBalances] = useState<{ usdc: bigint; owed: bigint; eth: bigint } | null>(null);
  const [coord, setCoord] = useState<CoordinatorProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [wd, setWd] = useState<{ hash?: string; ok?: boolean; error?: string } | null>(null);
  const me = address.toLowerCase();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [l, b] = await Promise.all([readLedger(), readWallet(address)]);
      setLedger(l);
      setBalances(b);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "The chain couldn't be read.");
    }
    // The provider list is private (operator only) on a public server, so it isn't asked for (ekido-ai/ekido-internal#93).
    if (!(await privateListsReadable())) return setCoord(null);
    fetch(`${config.coordinatorUrl}/providers`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCoord)
      .catch(() => setCoord(null));
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(() => {
    if (!ledger) return null;
    const jobs = ledger.jobs.filter((j) => j.split.client.toLowerCase() === me);
    const paidTo = ledger.jobs.filter((j) => j.split.payees.some((p) => p.toLowerCase() === me));
    const entries = ledger.book.entries.filter((e) => [e.debit, e.credit].some((a) => a === owed(me) || a === walletAccount(me)));
    const listing = compareListings(ledger.registry.filter((r) => r.wallet.toLowerCase() === me), coord).listings[0] ?? null;
    const coordRow = coord?.find((p) => p.wallet_address.toLowerCase() === me) ?? null;
    return { jobs, paidTo, entries, listing, coordRow };
  }, [ledger, coord, me]);

  async function withdraw() {
    setWithdrawing(true);
    setWd(null);
    try {
      const eth = injectedProvider();
      if (!eth) throw new Error("No browser wallet found.");
      const r = await withdrawFromEscrow(eth, address);
      setWd(r);
      await load();
    } catch (e) {
      setWd({ error: friendlyError(e) });
    } finally {
      setWithdrawing(false);
    }
  }

  function statement() {
    if (!ledger || !mine) return;
    const csv = journalCsv(mine.entries.map((e) => ({ ...e, time: new Date(ledger.times.get(e.block.toString()) ?? 0).toISOString() })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekido-statement-${short(address)}-block-${ledger.block}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your account"
        aside={demo ? <StatusPill tone="warning">Demo view as the {demo}, read-only</StatusPill> : <StatusPill tone="good">Signed in until {new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</StatusPill>}
      >
        <a href={scan("address", address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-ink underline decoration-line-strong underline-offset-4">
          {address} <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <span className="block text-sm">Everything below is read from Base Sepolia by your browser.</span>
      </PageHeader>

      {error && <ErrorState title="Couldn't read Base Sepolia" detail={error} onRetry={load} />}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="relative panel rounded-2xl border border-line p-5">
          {wd?.ok && <Celebrate key={wd.hash} />}
          <div className="text-sm text-ink-2">Owed to you by the escrow</div>
          <div className="mt-1 font-serif text-4xl text-trust trust-glow">{balances ? <AnimatedNumber value={Number(balances.owed) / 1e6} format={(n) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} /> : "…"} <span className="text-base text-ink-2">USDC</span></div>
          <Button variant="primary" className="mt-4" disabled={!!demo || !balances || balances.owed === BigInt(0) || withdrawing || balances.eth === BigInt(0)} onClick={withdraw}>
            {withdrawing ? "Confirm in your wallet…" : "Withdraw to my wallet"}
          </Button>
          {demo && <p className="mt-2 text-xs text-ink-2">Demo views can&apos;t withdraw. Sign in with your own wallet to move money.</p>}
          {!demo && balances && balances.owed > BigInt(0) && balances.eth === BigInt(0) && <p className="mt-2 text-xs text-warning">You need a little test ETH for gas first.</p>}
          {wd?.hash && (
            <p className="mt-2 text-sm text-ink">
              {wd.ok ? "Withdrawn. It's in your wallet now." : "The withdrawal failed."}{" "}
              <a className="underline underline-offset-4" href={scan("tx", wd.hash)} target="_blank" rel="noreferrer">View transaction</a>
            </p>
          )}
          {wd?.error && <p className="mt-2 text-sm text-critical">{wd.error}</p>}
        </div>
        <div className="panel rounded-2xl border border-line p-5">
          <div className="text-sm text-ink-2">Test USDC in your wallet</div>
          <div className="mt-1 font-serif text-4xl text-ink">{balances ? <AnimatedNumber value={Number(balances.usdc) / 1e6} format={(n) => n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} /> : "…"}</div>
          <p className="mt-4 text-xs text-muted">Used to fund jobs. Circle&apos;s faucet gives test USDC for Base Sepolia.</p>
        </div>
        <div className="panel rounded-2xl border border-line p-5">
          <div className="text-sm text-ink-2">Test ETH for gas</div>
          <div className="mt-1 font-serif text-4xl text-ink tabular">{balances ? eth(balances.eth) : "…"}</div>
          <p className="mt-4 text-xs text-muted">Pays network fees for withdrawing, funding and listing. Free from a Base Sepolia faucet.</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="As a provider" subtitle="Your listing, and the jobs that paid you">
          {!mine ? (
            <p className="text-ink-2">Reading…</p>
          ) : mine.coordRow || mine.listing ? (
            <div className="space-y-3 text-sm">
              {mine.coordRow && (
                <p className="text-ink">
                  Listed by the coordinator as <strong>{mine.coordRow.name}</strong> at <span className="tabular">{mine.coordRow.price_per_step.replace(/0+$/, "")}</span> USDC a step.
                </p>
              )}
              <p className="flex items-center gap-2 text-ink">
                <StatusIcon tone={mine.listing?.status === "matches" ? "good" : mine.listing ? "critical" : "warning"} />
                {mine.listing
                  ? mine.listing.status === "matches"
                    ? "Your on-chain commitment matches the coordinator's listing."
                    : mine.listing.status === "differs"
                      ? "The coordinator shows different terms from the ones you committed on-chain."
                      : "You're on-chain, but the coordinator doesn't list you."
                  : "Not listed on-chain yet. Run the join command again once this wallet has test ETH."}
              </p>
              <p className="text-ink-2">Paid in {mine.paidTo.length} settled job{mine.paidTo.length === 1 ? "" : "s"}.</p>
            </div>
          ) : (
            <p className="text-ink-2">
              This wallet isn&apos;t a provider. <Link href="/provide" className="text-ink underline underline-offset-4">Join as a device owner</Link> to start earning.
            </p>
          )}
        </Panel>

        <Panel title="As a client" subtitle="Jobs this wallet funded">
          {!mine ? (
            <p className="text-ink-2">Reading…</p>
          ) : mine.jobs.length === 0 ? (
            <p className="text-ink-2">No jobs funded from this wallet yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {mine.jobs.map((j) => {
                const paid = j.split.amounts.reduce((a, b) => a + b, BigInt(0));
                return (
                  <li key={j.jobId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-mono text-ink">{short(j.jobId)}</span>
                    <span className="text-ink-2">
                      {usdc(j.split.budget)} locked · {usdc(paid)} paid · {usdc(j.split.refund)} back
                    </span>
                    <StatusPill tone={STATES[j.split.state] === "Settled" ? "good" : "active"}>{STATES[j.split.state]}</StatusPill>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Statement"
        subtitle="Every movement of your money through the escrow, rebuilt from on-chain events"
        actions={<Button size="sm" onClick={statement} disabled={!mine?.entries.length}><Download className="size-4" aria-hidden /> Download CSV</Button>}
      >
        {!mine ? (
          <p className="text-ink-2">Reading…</p>
        ) : mine.entries.length === 0 ? (
          <p className="text-ink-2">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {mine.entries.map((e) => {
              const incoming = e.debit === owed(me) || e.debit === walletAccount(me);
              return (
                <li key={`${e.tx}-${e.logIndex}-${e.debit}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-ink">{e.memo}</span>
                  <span className="flex items-center gap-3">
                    <span className={incoming ? "font-semibold text-good tabular" : "font-semibold text-ink tabular"}>{incoming ? "+" : "−"}{usdc(e.amount)} USDC</span>
                    <a href={scan("tx", e.tx)} target="_blank" rel="noreferrer" className="font-mono text-xs text-ink-2 underline underline-offset-2">{short(e.tx)}</a>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="What signing in does">
        <ul className="grid gap-3 text-sm text-ink-2 md:grid-cols-3">
          <li><strong className="text-ink">Proves the address is yours.</strong> Your wallet signed a message naming this site, a one-time code and an expiry. We check it in your browser.</li>
          <li><strong className="text-ink">Can&apos;t spend.</strong> A signature like this can&apos;t move money. Withdrawals open your wallet again for a separate confirmation.</li>
          <li><strong className="text-ink">Stays in this tab.</strong> No password, email or cookie. Closing the tab or signing out forgets it. <Link href="/privacy#cookies" className="underline underline-offset-4">Details</Link></li>
        </ul>
      </Panel>
    </div>
  );
}
