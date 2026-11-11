import type { DashboardState } from "../events/reduce";

/**
 * A settlement receipt: the statement a client or provider files after a job, like an invoice.
 * Built only from the job's own settlement and chain events. Amounts are integer micro-USDC, so no
 * floating-point drift creeps into a total.
 */

export interface ReceiptLine {
  provider: string;
  provider_id: string;
  accepted_steps: number;
  rate_per_step_usdc: string | null;
  amount_usdc: string;
}

export interface Receipt {
  kind: "gpuchain.settlement_receipt.v1";
  job_id: string | null;
  issued_at: string;
  source: "live" | "recorded" | "sample" | "unknown";
  currency: string;
  network: "base-sepolia" | "anvil" | "unknown";
  lines: ReceiptLine[];
  unpaid: { provider: string; provider_id: string; rejected_steps: number; reason: string }[];
  totals: { paid_usdc: string; refund_usdc: string; budget_usdc: string; balanced: boolean };
  transactions: { kind: string; status: string; tx_hash: string; explorer_url: string | null }[];
  notes: string[];
}

const MICRO = BigInt(1_000_000);

export function toMicros(usdc: string): bigint {
  const value = usdc.trim();
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(value)) throw new Error("Invalid USDC amount");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const units = BigInt(whole) * MICRO + BigInt((fraction + "000000").slice(0, 6));
  return negative ? -units : units;
}

export function fromMicros(m: bigint): string {
  const negative = m < BigInt(0);
  const abs = negative ? -m : m;
  return `${negative ? "-" : ""}${abs / MICRO}.${(abs % MICRO).toString().padStart(6, "0")}`;
}

export function buildReceipt(state: DashboardState, issuedAt: string, source: Receipt["source"] = "unknown"): Receipt | null {
  const settlement = state.settlement;
  if (!settlement) return null;
  const name = (id: string) => state.providers[id]?.name ?? `Provider ${id}`;
  const lines = settlement.payees.map((p) => {
    const amount = toMicros(p.amount_usdc);
    return {
      provider: name(p.provider_id),
      provider_id: p.provider_id,
      accepted_steps: p.accepted_steps,
      rate_per_step_usdc: p.accepted_steps > 0 ? fromMicros(amount / BigInt(p.accepted_steps)) : null,
      amount_usdc: fromMicros(amount),
    };
  });
  const paid = settlement.payees.reduce((sum, p) => sum + toMicros(p.amount_usdc), BigInt(0));
  const refund = toMicros(settlement.refund_usdc);
  const budget = toMicros(settlement.budget_usdc);
  const network = state.chain.find((t) => t.chain)?.chain ?? "unknown";
  return {
    kind: "gpuchain.settlement_receipt.v1",
    job_id: state.jobId,
    issued_at: issuedAt,
    source,
    currency: "USDC (test tokens)",
    network,
    lines,
    unpaid: settlement.zero_paid.map((z) => ({ provider: name(z.provider_id), provider_id: z.provider_id, rejected_steps: z.rejected_steps, reason: z.reason })),
    totals: { paid_usdc: fromMicros(paid), refund_usdc: fromMicros(refund), budget_usdc: fromMicros(budget), balanced: paid + refund === budget },
    transactions: state.chain.map((t) => ({ kind: t.kind, status: t.status, tx_hash: t.tx_hash, explorer_url: t.explorer_url })),
    notes: [
      "Test tokens on a test network. This isn't a tax invoice.",
      "Amounts are from the settlement event and may be proposed, disputed or stale; this receipt does not prove the final split or withdrawal.",
      "Rates are effective amounts divided by accepted steps, not necessarily the agreed provider rates.",
      "Verify checks consistency against chain data but relies on coordinator-supplied metadata.",
      network === "anvil" ? "Local Anvil chain transactions have no public explorer." : network === "unknown" ? "The network was not recorded." : "Check each transaction on its explorer link.",
    ],
  };
}

function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Prevent untrusted names and identifiers from becoming spreadsheet formulas. */
function spreadsheetText(value: string): string {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
}

/** One row per line item, then totals: the shape a spreadsheet or accounting import expects. */
export function receiptCsv(receipt: Receipt): string {
  const rows: (string | number | null)[][] = [["type", "provider", "provider_id", "accepted_steps", "rate_per_step_usdc", "amount_usdc", "note"]];
  rows.push(["source", "", "", null, null, null, `${receipt.source}; network: ${receipt.network}; issued: ${receipt.issued_at}`]);
  rows.push(["notice", "", "", null, null, null, "Coordinator event values; final split and withdrawals are not independently verified."]);
  for (const l of receipt.lines) rows.push(["payout", spreadsheetText(l.provider), spreadsheetText(l.provider_id), l.accepted_steps, l.rate_per_step_usdc, l.amount_usdc, ""]);
  for (const u of receipt.unpaid) rows.push(["unpaid", spreadsheetText(u.provider), spreadsheetText(u.provider_id), 0, null, "0.000000", `${u.rejected_steps} steps rejected: ${u.reason}`]);
  rows.push(["refund", "client", "", null, null, receipt.totals.refund_usdc, ""]);
  rows.push(["total", "", "", null, null, receipt.totals.budget_usdc, receipt.totals.balanced ? "payouts plus refund equal the budget" : "DOES NOT BALANCE"]);
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
