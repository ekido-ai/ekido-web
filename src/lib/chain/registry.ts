import { keccak256, parseAbi, toBytes, type Address } from "viem";
import type { Hex } from "./ledger";

/**
 * Provider listings committed by the providers' own wallets in ProviderRegistry, compared with what the
 * coordinator publishes. Mirrors packages/ekido_core/ekido_core/provider_meta.py byte for byte.
 */

export const REGISTRY_EVENTS = parseAbi([
  "event ProviderRegistered(address indexed provider, bytes32 metadataHash)",
  "event ProviderUpdated(address indexed provider, bytes32 metadataHash)",
]);
export const REGISTRY_ABI = parseAbi([
  "struct Provider { bool registered; bytes32 metadataHash; bytes32 passportRoot; }",
  "function getProvider(address provider) view returns (Provider)",
]);
export const REGISTRY_DEPLOY_BLOCK = BigInt(55622048);

export interface ProviderMeta {
  kind: "gpuchain.provider_meta.v1";
  name: string;
  wallet: string;
  price_per_step_micros: number;
  capacity_mib: number | null;
}

/** Whole micro-USDC from a decimal string such as "0.002000". Null when it isn't exact. */
export function priceMicros(price: string): number | null {
  const m = /^(\d+)(?:\.(\d{1,6})0*)?$/.exec(price.trim());
  if (!m) return null;
  const micros = Number(m[1]) * 1_000_000 + Number((m[2] ?? "").padEnd(6, "0"));
  return micros > 0 && Number.isSafeInteger(micros) ? micros : null;
}

export function providerMetadata(name: string, wallet: string, price: string, capacityMib: number | null): ProviderMeta | null {
  const micros = priceMicros(price);
  if (micros === null) return null;
  return { kind: "gpuchain.provider_meta.v1", name: name.trim(), wallet: wallet.toLowerCase(), price_per_step_micros: micros, capacity_mib: capacityMib };
}

/** RFC 8785 for this flat shape: keys sorted, no spaces. JSON.stringify escapes strings the same way. */
export function canonical(meta: ProviderMeta): string {
  const keys = Object.keys(meta).sort() as (keyof ProviderMeta)[];
  return `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(meta[k])}`).join(",")}}`;
}

export function metadataHash(meta: ProviderMeta): Hex {
  return keccak256(toBytes(canonical(meta)));
}

export type ListingStatus = "matches" | "differs" | "not-listed";

export interface Listing {
  wallet: Address;
  onchainHash: Hex;
  block: bigint;
  tx: Hex;
  updates: number;
  status: ListingStatus;
  coordinatorName: string | null;
  coordinatorPrice: string | null;
}

export interface CoordinatorProvider {
  name: string;
  wallet_address: string;
  price_per_step: string;
  capacity_mib: number | null;
}

/** Joins the chain's view with the coordinator's. The browser recomputes every hash; the coordinator's own claim isn't used. */
export function compareListings(
  onchain: { wallet: Address; hash: Hex; block: bigint; tx: Hex; updates: number }[],
  coordinator: CoordinatorProvider[] | null,
): { listings: Listing[]; offChainOnly: number } {
  const byWallet = new Map((coordinator ?? []).map((p) => [p.wallet_address.toLowerCase(), p]));
  const listings = onchain.map((o) => {
    const c = byWallet.get(o.wallet.toLowerCase());
    let status: ListingStatus = "not-listed";
    if (c) {
      const meta = providerMetadata(c.name, c.wallet_address, c.price_per_step, c.capacity_mib);
      status = meta && metadataHash(meta).toLowerCase() === o.hash.toLowerCase() ? "matches" : "differs";
    }
    return { wallet: o.wallet, onchainHash: o.hash, block: o.block, tx: o.tx, updates: o.updates, status, coordinatorName: c?.name ?? null, coordinatorPrice: c?.price_per_step ?? null };
  });
  const onchainWallets = new Set(onchain.map((o) => o.wallet.toLowerCase()));
  const offChainOnly = (coordinator ?? []).filter((p) => !onchainWallets.has(p.wallet_address.toLowerCase())).length;
  return { listings, offChainOnly };
}

/**
 * Whether a wallet is a provider, for the account page: listed by the coordinator, committed in ProviderRegistry, or
 * paid for accepted work in at least one job. A paid wallet counts even when it isn't registered
 * (ekido-ai/ekido-core#106).
 */
export function isProvider(seen: { coordRow: unknown; listing: unknown; paidJobs: number }): boolean {
  return !!seen.coordRow || !!seen.listing || seen.paidJobs > 0;
}
