import { fromMicros, toMicros, type Receipt } from "./receipt";

/** One provider's earnings across many settled jobs, built from their receipts. */
export interface LedgerRow {
  provider_id: string;
  provider: string;
  paid_jobs: number;
  unpaid_jobs: number;
  accepted_steps: number;
  rejected_steps: number;
  earned_usdc: string;
}

export function providerLedger(receipts: readonly Receipt[]): LedgerRow[] {
  const rows = new Map<string, { row: LedgerRow; earned: bigint }>();
  const get = (id: string, name: string) => {
    if (!rows.has(id)) rows.set(id, { row: { provider_id: id, provider: name, paid_jobs: 0, unpaid_jobs: 0, accepted_steps: 0, rejected_steps: 0, earned_usdc: "0.000000" }, earned: BigInt(0) });
    return rows.get(id)!;
  };
  for (const receipt of receipts) {
    for (const line of receipt.lines) {
      const entry = get(line.provider_id, line.provider);
      entry.row.paid_jobs += 1;
      entry.row.accepted_steps += line.accepted_steps;
      entry.earned += toMicros(line.amount_usdc);
    }
    for (const unpaid of receipt.unpaid) {
      const entry = get(unpaid.provider_id, unpaid.provider);
      entry.row.unpaid_jobs += 1;
      entry.row.rejected_steps += unpaid.rejected_steps;
    }
  }
  return [...rows.values()]
    .map(({ row, earned }) => ({ ...row, earned_usdc: fromMicros(earned) }))
    .sort((a, b) => (toMicros(b.earned_usdc) > toMicros(a.earned_usdc) ? 1 : toMicros(b.earned_usdc) < toMicros(a.earned_usdc) ? -1 : a.provider.localeCompare(b.provider)));
}

export interface SettlementRecord {
  job_id: string;
  status: string;
  verdict: { payees?: string[]; amounts?: (string | number)[] } | null;
}

export interface EarningsRow {
  wallet: string;
  provider: string;
  paid_jobs: number;
  earned_usdc: string;
}

/** Earnings per wallet from settled jobs only. Verdict amounts are USDC base units (1 USDC = 1,000,000). */
export function earningsFromSettlements(settlements: readonly SettlementRecord[], names: ReadonlyMap<string, string>): EarningsRow[] {
  const rows = new Map<string, { paid: number; units: bigint }>();
  for (const s of settlements) {
    if (s.status !== "SETTLED" || !s.verdict?.payees) continue;
    if (!s.verdict.amounts || s.verdict.payees.length !== s.verdict.amounts.length) throw new Error("A settlement has incomplete verdict amounts.");
    s.verdict.payees.forEach((payee, i) => {
      const amount = s.verdict!.amounts![i];
      if ((typeof amount === "number" && (!Number.isSafeInteger(amount) || amount < 0)) || !/^\d+$/.test(String(amount))) {
        throw new Error("A settlement has an invalid or imprecise verdict amount.");
      }
      const wallet = payee.toLowerCase();
      const entry = rows.get(wallet) ?? { paid: 0, units: BigInt(0) };
      entry.paid += 1;
      entry.units += BigInt(String(amount));
      rows.set(wallet, entry);
    });
  }
  return [...rows.entries()]
    .map(([wallet, e]) => ({ wallet, provider: names.get(wallet) ?? "Unknown wallet", paid_jobs: e.paid, earned_usdc: fromMicros(e.units) }))
    .sort((a, b) => (toMicros(b.earned_usdc) > toMicros(a.earned_usdc) ? 1 : toMicros(b.earned_usdc) < toMicros(a.earned_usdc) ? -1 : a.wallet.localeCompare(b.wallet)));
}
