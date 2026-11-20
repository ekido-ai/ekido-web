"use client";

import { useCallback, useEffect, useState } from "react";
import { Fuel, Landmark, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAbi } from "viem";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { StatusIcon, type Tone } from "@/components/ui/status";
import { SkeletonLines } from "@/components/ui/states";
import { BASE_SEPOLIA, chainClients } from "@/lib/chain/read";
import { usdc } from "@/lib/chain/ledger";
import { config } from "@/lib/config";

/*
 * The network's health for the owner: escrow reserves, gas on the roles that send transactions, and the protocol fee.
 * Read live from Base Sepolia and the Coordinator's public /fees. Moved here from the old public owner console.
 */

const abi = parseAbi([
  "function coordinator() view returns (address)",
  "function arbiter() view returns (address)",
  "function owner() view returns (address)",
  "function withdrawable(address) view returns (uint256)",
  "function totalLocked() view returns (uint256)",
  "function totalWithdrawable() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
const LOW_GAS_WEI = BigInt(2) * BigInt(10) ** BigInt(15); // 0.002 ETH: a handful of settlements left.
const eth = (wei: bigint) => (Number(wei) / 1e18).toFixed(4);
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

type Role = "coordinator" | "arbiter" | "owner";
type Health = {
  roles: { role: Role; address: string; wei: bigint; needsGas: boolean }[];
  feeRecipient: string | null;
  feeBps: number | null;
  feesOwed: bigint | null;
  held: bigint;
  owed: bigint;
};

export function NetworkHealth() {
  const t = useTranslations("admin.network");
  const [health, setHealth] = useState<Health | null | "failed">(null);

  const fetchHealth = useCallback(() => readHealth().then(setHealth), []);
  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);
  const load = () => {
    setHealth(null);
    void fetchHealth();
  };

  if (health === null) return <Panel title={t("title")}><SkeletonLines lines={4} /></Panel>;
  if (health === "failed")
    return (
      <Panel title={t("title")} actions={<Button size="sm" onClick={load}>{t("retry")}</Button>}>
        <p className="text-sm text-ink-2">{t("chainUnreachable")}</p>
      </Panel>
    );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Panel title={t("title")} actions={<Button size="sm" onClick={load}>{t("refresh")}</Button>}>
        <ul className="space-y-3 text-sm">
          <Row icon={ShieldCheck} tone={health.held >= health.owed ? "good" : "critical"} label={t("reserves")} value={t("reservesValue", { held: usdc(health.held), owed: usdc(health.owed) })} />
          {health.roles.map((r) => (
            <Row
              key={r.role}
              icon={Fuel}
              tone={r.needsGas ? "warning" : "good"}
              label={t(`role.${r.role}`)}
              value={r.needsGas ? t("gasLow", { eth: eth(r.wei) }) : t("gas", { eth: eth(r.wei) })}
              sub={short(r.address)}
            />
          ))}
        </ul>
      </Panel>
      <div className="space-y-6">
        <Panel title={t("revenueTitle")} subtitle={t("revenueLead")}>
          {health.feeRecipient ? (
            <div className="space-y-1 text-sm">
              <p className="text-ink">{t("feeTo", { percent: (health.feeBps ?? 0) / 100, address: short(health.feeRecipient) })}</p>
              <p className="text-3xl font-semibold text-ink tabular">{t("feesOwed", { amount: usdc(health.feesOwed ?? BigInt(0)) })}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-2">{t("noFee")}</p>
          )}
        </Panel>
        <Panel title={t("moneyTitle")}>
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Landmark className="size-4 text-ink" aria-hidden /> {t("moneyLead")}{" "}
            <a href="/chain" className="text-ink underline underline-offset-4">{t("chainLink")}</a>
          </p>
        </Panel>
      </div>
    </div>
  );
}

/** Reads the network's health; never throws. */
async function readHealth(): Promise<Health | "failed"> {
  try {
    const fees = await fetch(`${config.coordinatorUrl}/fees`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ protocol_fee: { bps: number; recipient: string } | null }>) : null))
      .catch(() => null);
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
    const list: { role: Role; address: `0x${string}`; gas: boolean }[] = [
      { role: "coordinator", address: coordinator, gas: true },
      { role: "arbiter", address: arbiter, gas: false },
      { role: "owner", address: owner, gas: false },
    ];
    const weis = await Promise.all(list.map((r) => reads.getBalance({ address: r.address })));
    const recipient = fees?.protocol_fee?.recipient ?? null;
    const feesOwed = recipient ? await reads.readContract({ ...at, functionName: "withdrawable", args: [recipient as `0x${string}`] }) : null;
    return {
      roles: list.map((r, i) => ({ role: r.role, address: r.address, wei: weis[i], needsGas: r.gas && weis[i] < LOW_GAS_WEI })),
      feeRecipient: recipient,
      feeBps: fees?.protocol_fee?.bps ?? null,
      feesOwed,
      held,
      owed: locked + withdrawable,
    };
  } catch {
    return "failed";
  }
}

function Row({ icon: Icon, tone, label, value, sub }: { icon: typeof Fuel; tone: Tone; label: string; value: string; sub?: string }) {
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
