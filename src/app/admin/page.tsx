"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, Fuel, Landmark, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { parseAbi } from "viem";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusIcon, type Tone } from "@/components/ui/status";
import { cx } from "@/components/ui/cx";
import { useSession } from "@/components/wallet/wallet-button";
import { BASE_SEPOLIA, chainClients } from "@/lib/chain/read";
import { usdc } from "@/lib/chain/ledger";
import { DEMO_ADDRESSES, viewAs } from "@/lib/wallet/session";
import { config } from "@/lib/config";

/*
 * Owner console. A dispatcher's board: jobs by stage, one counter coloured only when someone must act, and the
 * health of the wallets that keep the network running. Everything here is public data read by the browser, so
 * the page needs no secret; actions that change anything stay with the operator tools and the owner's wallet.
 */

interface JobRow { job_id: string; state: string; total_steps: number | null; budget_usdc: string; created_at: string }
interface Preview { steps?: Record<string, number>; payouts?: Record<string, string>; refund?: string; protocol_fee?: { amount: string } | null }

const COLUMNS: { title: string; states: string[] }[] = [
  { title: "Funded", states: ["OPEN", "ASSIGNED"] },
  { title: "Training", states: ["RUNNING", "RECOVERING"] },
  { title: "Checking", states: ["VALIDATING", "COMPLETED", "DISPUTED"] },
  { title: "Done", states: ["SETTLED", "REFUNDED", "FAILED", "CANCELLED"] },
];
const ATTENTION = new Set(["COMPLETED", "DISPUTED", "FAILED"]);
const LOW_GAS_WEI = BigInt(2) * BigInt(10) ** BigInt(15); // 0.002 ETH: a handful of settlements left.

const abi = parseAbi([
  "function coordinator() view returns (address)",
  "function arbiter() view returns (address)",
  "function owner() view returns (address)",
  "function withdrawable(address) view returns (uint256)",
  "function totalLocked() view returns (uint256)",
  "function totalWithdrawable() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const eth = (wei: bigint) => (Number(wei) / 1e18).toFixed(4);
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

interface Health {
  roles: { label: string; address: string; wei: bigint; needsGas: boolean }[];
  feeRecipient: string | null;
  feeBps: number | null;
  feesOwed: bigint | null;
  held: bigint;
  owed: bigint;
}

export default function AdminPage() {
  const router = useRouter();
  const session = useSession();
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [health, setHealth] = useState<Health | null>(null);
  const [providers, setProviders] = useState<{ status: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [coordDown, setCoordDown] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const isOwner = session?.address.toLowerCase() === DEMO_ADDRESSES.owner.toLowerCase();

  const load = useCallback(async () => {
    setBusy(true);
    const api = config.coordinatorUrl;
    const get = async <T,>(path: string): Promise<T | null> => {
      try {
        const r = await fetch(api + path, { signal: AbortSignal.timeout(8000) });
        return r.ok ? ((await r.json()) as T) : null;
      } catch {
        return null;
      }
    };
    const [rows, provs, fees] = await Promise.all([get<JobRow[]>("/jobs?limit=40"), get<{ status: string }[]>("/providers"), get<{ protocol_fee: { bps: number; recipient: string } | null }>("/fees")]);
    setJobs(rows ?? []);
    setCoordDown(rows === null);
    setProviders(provs);
    if (rows) {
      const entries = await Promise.all(rows.slice(0, 20).map(async (j) => [j.job_id, (await get<Preview>(`/jobs/${j.job_id}/settlement-preview`)) ?? {}] as const));
      setPreviews(Object.fromEntries(entries));
    }
    try {
      const { reads } = chainClients();
      const at = { address: BASE_SEPOLIA.escrow, abi } as const;
      const [coordinator, arbiter, owner, locked, withdrawable, held] = await Promise.all([
        reads.readContract({ ...at, functionName: "coordinator" }),
        reads.readContract({ ...at, functionName: "arbiter" }),
        reads.readContract({ ...at, functionName: "owner" }),
        reads.readContract({ ...at, functionName: "totalLocked" }),
        reads.readContract({ ...at, functionName: "totalWithdrawable" }),
        reads.readContract({ address: BASE_SEPOLIA.usdc, abi, functionName: "balanceOf", args: [BASE_SEPOLIA.escrow] }),
      ]);
      const list = [
        { label: "Coordinator (sends settlements)", address: coordinator, gas: true },
        { label: "Arbiter (decides disputes)", address: arbiter, gas: false },
        { label: "Owner (sets verifiers)", address: owner, gas: false },
      ];
      const weis = await Promise.all(list.map((r) => reads.getBalance({ address: r.address })));
      const recipient = fees?.protocol_fee?.recipient ?? null;
      const feesOwed = recipient ? await reads.readContract({ ...at, functionName: "withdrawable", args: [recipient as `0x${string}`] }) : null;
      setHealth({
        roles: list.map((r, i) => ({ label: r.label, address: r.address, wei: weis[i], needsGas: r.gas && weis[i] < LOW_GAS_WEI })),
        feeRecipient: recipient,
        feeBps: fees?.protocol_fee?.bps ?? null,
        feesOwed,
        held,
        owed: locked + withdrawable,
      });
    } catch {
      setHealth(null);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = jobs ?? [];
  const running = list.filter((j) => ["RUNNING", "RECOVERING", "ASSIGNED", "VALIDATING"].includes(j.state)).length;
  const attention = list.filter((j) => ATTENTION.has(j.state)).length + (health?.roles.some((r) => r.needsGas) ? 1 : 0);
  const done = list.filter((j) => ["SETTLED", "REFUNDED"].includes(j.state)).length;
  const counters: { label: string; value: number | string; act?: boolean }[] = [
    { label: "Jobs", value: coordDown ? "–" : jobs ? list.length : "…" },
    { label: "Training now", value: coordDown ? "–" : jobs ? running : "…" },
    { label: "Needs you", value: coordDown ? "–" : jobs ? attention : "…", act: attention > 0 },
    { label: "Settled", value: coordDown ? "–" : jobs ? done : "…" },
  ];

  function route(p: Preview | undefined): string {
    const names = Object.keys(p?.steps ?? {});
    return names.length ? names.map((n) => n.replace(/ \(.*\)$/, "")).join(" → ") : "No accepted work yet";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner console"
        aside={
          <Button onClick={load} disabled={busy}>
            <RefreshCw className={cx("size-4", busy && "animate-spin")} aria-hidden /> Refresh
          </Button>
        }
      >
        {isOwner ? "You're viewing as the escrow owner." : "Everything here is public, read live by your browser. Changing anything still needs the operator's tools or the owner's wallet."}
      </PageHeader>

      {coordDown && <p className="rounded-lg border border-warning bg-surface-2 p-3 text-sm text-ink">The coordinator didn&apos;t answer, so the job board is empty for now. The chain figures on the right are still live.</p>}

      {/* Counters: only the one that needs action gets colour. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counters.map((c) => (
          <div key={c.label} className={cx("rounded-xl border p-4", c.act ? "border-transparent bg-[linear-gradient(135deg,#ff6a33,#fab219)] text-black" : "border-line bg-surface")}>
            <div className={cx("text-sm", c.act ? "text-black/70" : "text-ink-2")}>{c.label}</div>
            <div className={cx("mt-1 text-4xl font-semibold tabular", c.act ? "text-black" : "text-ink")}>{c.value}</div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* The board. */}
        <section aria-label="Jobs by stage" className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = list.filter((j) => col.states.includes(j.state));
            return (
              <div key={col.title} className="rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
                  <span className="rounded-full bg-surface-3 px-2 text-xs text-ink-2 tabular">{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.length === 0 && <li className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">Nothing here</li>}
                  {items.map((j) => {
                    const p = previews[j.job_id];
                    const expanded = open === j.job_id;
                    return (
                      <li key={j.job_id} className={cx("rounded-lg border bg-surface p-3", ATTENTION.has(j.state) ? "border-warning" : "border-line")}>
                        <button type="button" onClick={() => setOpen(expanded ? null : j.job_id)} aria-expanded={expanded} className="w-full text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-ink">{route(p)}</span>
                            <ChevronDown className={cx("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} aria-hidden />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-ink-2">
                            <span className="tabular">{Number(j.budget_usdc).toString()} USDC</span>
                            <span>{j.state.toLowerCase()}</span>
                          </div>
                        </button>
                        {expanded && (
                          <dl className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-ink-2">
                            <div className="flex justify-between gap-2"><dt>Job</dt><dd className="font-mono text-ink">{short(j.job_id)}</dd></div>
                            <div className="flex justify-between gap-2"><dt>Created</dt><dd>{new Date(j.created_at + "Z").toLocaleString()}</dd></div>
                            <div className="flex justify-between gap-2"><dt>Steps</dt><dd className="tabular">{j.total_steps ?? "–"}</dd></div>
                            {Object.entries(p?.payouts ?? {}).map(([who, amt]) => (
                              <div key={who} className="flex justify-between gap-2"><dt className="truncate">{who}</dt><dd className="tabular text-ink">{Number(amt)} USDC</dd></div>
                            ))}
                            {p?.protocol_fee && <div className="flex justify-between gap-2"><dt>Protocol fee</dt><dd className="tabular text-ink">{Number(p.protocol_fee.amount)} USDC</dd></div>}
                            {p?.refund && <div className="flex justify-between gap-2"><dt>Back to client</dt><dd className="tabular">{Number(p.refund)} USDC</dd></div>}
                          </dl>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        <div className="space-y-6">
          <Panel title="Network health">
            <ul className="space-y-3 text-sm">
              <Row icon={Server} tone={providers ? "good" : "critical"} label="Providers online" value={providers ? String(providers.filter((p) => p.status !== "offline").length) : "coordinator unreachable"} />
              <Row
                icon={ShieldCheck}
                tone={health ? (health.held >= health.owed ? "good" : "critical") : "idle"}
                label="Escrow reserves"
                value={health ? `${usdc(health.held)} held / ${usdc(health.owed)} owed` : "…"}
              />
              {health?.roles.map((r) => (
                <Row key={r.label} icon={Fuel} tone={r.needsGas ? "warning" : "good"} label={r.label} value={`${eth(r.wei)} ETH${r.needsGas ? ", top up soon" : ""}`} sub={short(r.address)} />
              ))}
            </ul>
          </Panel>

          <Panel title="Revenue" subtitle="The protocol fee, on accepted work only">
            {health?.feeRecipient ? (
              <div className="space-y-1 text-sm">
                <p className="text-ink">
                  {(health.feeBps ?? 0) / 100}% to <span className="font-mono">{short(health.feeRecipient)}</span>
                </p>
                <p className="text-3xl font-semibold text-ink tabular">{usdc(health.feesOwed ?? BigInt(0))} <span className="text-base font-normal text-ink-2">USDC earned, waiting to withdraw</span></p>
              </div>
            ) : (
              <p className="text-sm text-ink-2">No fee is charged on this network yet. The 8% fee is built and tested; it switches on with the next coordinator settings change.</p>
            )}
          </Panel>

          <Panel title="Demo views" subtitle="See the site as each kind of user, read-only, using public testnet addresses">
            <div className="grid gap-2">
              {(["client", "provider", "owner"] as const).map((role) => (
                <Button
                  key={role}
                  onClick={() => {
                    viewAs(role);
                    router.push(role === "owner" ? "/admin" : "/account");
                  }}
                  className="justify-start"
                >
                  <Eye className="size-4" aria-hidden /> View as the {role}
                  <span className="ml-auto font-mono text-xs text-muted">{short(DEMO_ADDRESSES[role])}</span>
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Demo views sign nothing and can&apos;t withdraw. Sign out from the header to leave.</p>
          </Panel>

          <Panel title="Where the money is">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Landmark className="size-4 text-ink" aria-hidden /> Full journal, reconciliation and every provider&apos;s commitment are on the{" "}
              <a href="/chain" className="text-ink underline underline-offset-4">On-chain page</a>.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, tone, label, value, sub }: { icon: typeof Server; tone: Tone; label: string; value: string; sub?: string }) {
  return (
    <li className="flex items-start gap-3">
      <StatusIcon tone={tone} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-ink-2"><Icon className="size-3.5" aria-hidden />{label}</div>
        <div className="font-medium text-ink">{value}</div>
        {sub && <div className="font-mono text-xs text-muted">{sub}</div>}
      </div>
    </li>
  );
}
