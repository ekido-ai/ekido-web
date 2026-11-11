import { parseUnits, sha256, stringToHex } from "viem";

/**
 * Lets anyone re-check a payout from public data, without trusting this dashboard's server.
 * Pure and tested against vectors from the Python code in gpuchain_core/settlement.py, which built the signed verdict.
 */

export interface CheckpointRow {
  manifest_hash: string;
  parent_hash: string | null;
  logical_step: number;
  signer: string | null;
}

/** Walks parents from the final checkpoint back to the first. Throws if the chain is broken. */
export function lineageOf(rows: readonly CheckpointRow[], finalHash: string): CheckpointRow[] {
  const byHash = new Map(rows.map((row) => [row.manifest_hash.toLowerCase(), row]));
  const chain: CheckpointRow[] = [];
  const seen = new Set<string>();
  let next: string | null = finalHash.toLowerCase().replace(/^0x/, "");
  while (next) {
    if (seen.has(next)) throw new Error("The checkpoint chain loops");
    const row = byHash.get(next);
    if (!row) throw new Error(`Checkpoint ${next.slice(0, 10)} is missing from the chain`);
    seen.add(next);
    chain.push(row);
    next = row.parent_hash ? row.parent_hash.toLowerCase() : null;
  }
  return chain.reverse();
}

/** Same bytes as document_hash({"kind": ..., "manifests": [...]}): sorted keys and no spaces, in RFC 8785 form. */
export function lineageRoot(manifestHashes: readonly string[]): `0x${string}` {
  const canonical = `{"kind":"gpuchain.lineage.v1","manifests":[${manifestHashes.map((hash) => `"${hash}"`).join(",")}]}`;
  return sha256(stringToHex(canonical));
}

/** Logical steps each signer contributed. Work outside the chain, like a rejected attempt, counts for nothing. */
export function stepsBySigner(chain: readonly CheckpointRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  let previous = 0;
  for (const row of chain) {
    const signer = (row.signer ?? "").toLowerCase();
    totals.set(signer, (totals.get(signer) ?? 0) + row.logical_step - previous);
    previous = row.logical_step;
  }
  return totals;
}

export interface ProviderTerms {
  wallet_address?: string | null;
  enrolled_key?: string | null;
  /** Every key this provider has used. An agent that restarted has more than one. */
  signing_keys?: string[] | null;
  price_per_step: string;
  name: string;
}

/** What each wallet should receive in USDC base units, by steps times the rate. Stops at the budget, in the same order the coordinator does. */
/**
 * Same rule as gpuchain_core/protocol_fee.py: providers are capped at budget × 10000 / (10000 + bps), then
 * the fee is their total × bps / 10000, both rounded down to whole micro-USDC.
 */
export function expectedPayouts(
  steps: ReadonlyMap<string, number>,
  providers: readonly ProviderTerms[],
  budget: bigint,
  fee: { bps: number; recipient: string } | null = null,
): Map<string, bigint> {
  const out = new Map<string, bigint>();
  let remaining = fee ? (budget * BigInt(10_000)) / BigInt(10_000 + fee.bps) : budget;
  for (const signer of [...steps.keys()].sort()) {
    const provider = providers.find((p) => [p.enrolled_key, ...(p.signing_keys ?? [])].some((key) => (key ?? "").toLowerCase() === signer));
    if (!provider?.wallet_address) throw new Error(`No provider is enrolled with signer ${signer.slice(0, 10)}`);
    const rate = parseUnits(provider.price_per_step, 6);
    const owed = rate * BigInt(steps.get(signer) ?? 0);
    const amount = owed < remaining ? owed : remaining;
    if (amount > BigInt(0)) {
      const wallet = provider.wallet_address.toLowerCase();
      out.set(wallet, (out.get(wallet) ?? BigInt(0)) + amount);
      remaining -= amount;
    }
  }
  if (fee) {
    const total = [...out.values()].reduce((a, b) => a + b, BigInt(0));
    const cut = (total * BigInt(fee.bps)) / BigInt(10_000);
    const to = fee.recipient.toLowerCase();
    if (cut > BigInt(0)) out.set(to, (out.get(to) ?? BigInt(0)) + cut);
  }
  return out;
}
