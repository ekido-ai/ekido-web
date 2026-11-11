import { createPublicClient, fallback, http, parseAbi, parseEventLogs, type Address, type Log, type PublicClient } from "viem";
import { config } from "../config";
import { REGISTRY_EVENTS } from "./registry";
import { buildBook, reconcile, reserves, sortEvents, type Book, type EscrowEvent, type Hex, type JobSplit, type Reconciliation, type Reserves } from "./ledger";

/**
 * The Base Sepolia deployment, from contracts/broadcast/Deploy.s.sol/84532/run-latest.json.
 * Public addresses only. This page reads Base Sepolia whatever chain the local demo uses.
 */
export const BASE_SEPOLIA = {
  chainId: 84532,
  name: "Base Sepolia",
  escrow: "0x1BF65f755457a92850009c88AFb337Ec57745a22" as Address,
  registry: "0xcdf927CE0D885552529C5463993e64429a51c2Ff" as Address,
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
  deployBlock: BigInt(55622043),
  explorer: "https://sepolia.basescan.org",
  /** The public endpoint caps eth_getLogs at 200 blocks; this one allows 50,000, so the history takes ~20 calls. */
  logsRpc: "https://base-sepolia-rpc.publicnode.com",
  readRpcs: ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"],
};

const LOG_RANGE = BigInt(50_000);

const events = parseAbi([
  "event JobCreated(bytes32 indexed jobId, address indexed client, uint256 budget, bytes32 specHash, bytes32 policyHash)",
  "event JobCancelled(bytes32 indexed jobId)",
  "event JobActivated(bytes32 indexed jobId)",
  "event JobAnchor(bytes32 indexed jobId, uint8 indexed kind, uint32 attempt, bytes32 dataHash)",
  "event JobAttested(bytes32 indexed jobId, bool passed, bytes32 finalCheckpoint, uint64 disputeEnd)",
  "event JobDisputed(bytes32 indexed jobId, uint256 bond)",
  "event DisputeResolved(bytes32 indexed jobId, bool clientUpheld)",
  "event JobSettled(bytes32 indexed jobId, uint256 paid, uint256 refunded)",
  "event JobRefunded(bytes32 indexed jobId, uint256 amount)",
  "event Withdrawal(address indexed account, uint256 amount)",
  "event VerifierSetUpdated(uint32 indexed setId, address[] verifiers, uint256 quorum)",
]);

const escrowAbi = parseAbi([
  "struct Job { address client; uint64 deadline; uint8 state; uint32 verifierSet; uint64 disputeWindow; uint64 disputeEnd; uint64 disputedAt; bool passed; uint256 budget; uint256 bond; uint256 refund; bytes32 specHash; bytes32 policyHash; bytes32 finalCheckpoint; address[] payees; uint256[] amounts; address arbiter; }",
  "function getJob(bytes32 jobId) view returns (Job)",
  "function totalLocked() view returns (uint256)",
  "function totalWithdrawable() view returns (uint256)",
  "function withdrawable(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function coordinator() view returns (address)",
  "function arbiter() view returns (address)",
  "function currentVerifierSet() view returns (uint32)",
  "function quorumOf(uint32) view returns (uint256)",
  "function disputeBond() view returns (uint256)",
  "function REFUND_GRACE() view returns (uint64)",
  "function ARBITER_TIMEOUT() view returns (uint64)",
]);

const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"]);

export const STATES = ["None", "Funded", "Active", "Attested", "Disputed", "Settled", "Refunded", "Cancelled"];

export interface TxCost {
  tx: Hex;
  gasUsed: bigint;
  feeWei: bigint;
  from: Hex;
}

export interface ChainJob {
  jobId: Hex;
  split: JobSplit;
  events: EscrowEvent[];
}

export interface Ledger {
  block: bigint;
  readAt: number;
  roles: { owner: Hex; coordinator: Hex; arbiter: Hex; verifiers: Hex[]; quorum: bigint; setId: number; bond: bigint };
  counters: { totalLocked: bigint; totalWithdrawable: bigint; held: bigint };
  reserves: Reserves;
  jobs: ChainJob[];
  events: EscrowEvent[];
  book: Book;
  withdrawableOf: Map<Hex, bigint>;
  checks: Reconciliation[];
  times: Map<string, number>;
  costs: Map<string, TxCost>;
  logCalls: number;
  /** Where the event history came from. The index is only used when its result reconciles with the chain. */
  source: "index" | "chain";
  /** Provider listings committed in ProviderRegistry, latest hash per wallet. */
  registry: { wallet: Address; hash: Hex; block: bigint; tx: Hex; updates: number }[];
}

export function chainClients(): { reads: PublicClient; logs: PublicClient } {
  return {
    reads: createPublicClient({ transport: fallback(BASE_SEPOLIA.readRpcs.map((u) => http(u, { timeout: 10_000 }))) }) as PublicClient,
    logs: createPublicClient({ transport: http(BASE_SEPOLIA.logsRpc, { timeout: 20_000 }) }) as PublicClient,
  };
}

type Decoded = { eventName: string; args: Record<string, unknown>; blockNumber: bigint | null; logIndex: number | null; transactionHash: Hex | null };

function toEvent(log: Decoded): EscrowEvent | { kind: "verifiers"; verifiers: Hex[]; quorum: bigint; setId: number } | null {
  const ref = { block: log.blockNumber ?? BigInt(0), logIndex: log.logIndex ?? 0, tx: (log.transactionHash ?? "0x") as Hex };
  const a = log.args as Record<string, never>;
  switch (log.eventName) {
    case "JobCreated": return { ...ref, kind: "created", jobId: a.jobId, client: a.client, budget: a.budget };
    case "JobActivated": return { ...ref, kind: "activated", jobId: a.jobId };
    case "JobAnchor": return { ...ref, kind: "anchor", jobId: a.jobId, anchorKind: Number(a.kind), attempt: Number(a.attempt) };
    case "JobAttested": return { ...ref, kind: "attested", jobId: a.jobId, passed: a.passed };
    case "JobDisputed": return { ...ref, kind: "disputed", jobId: a.jobId, bond: a.bond };
    case "DisputeResolved": return { ...ref, kind: "resolved", jobId: a.jobId, clientUpheld: a.clientUpheld };
    case "JobSettled": return { ...ref, kind: "settled", jobId: a.jobId, paid: a.paid, refunded: a.refunded };
    case "JobRefunded": return { ...ref, kind: "refunded", jobId: a.jobId, amount: a.amount };
    case "JobCancelled": return { ...ref, kind: "cancelled", jobId: a.jobId };
    case "Withdrawal": return { ...ref, kind: "withdrawal", account: a.account, amount: a.amount };
    case "VerifierSetUpdated": return { kind: "verifiers", verifiers: a.verifiers, quorum: a.quorum, setId: Number(a.setId) };
    default: return null;
  }
}

/** Reads the escrow's whole history and present state straight from Base Sepolia. Nothing comes from the coordinator. */
/** Index first; if anything fails to reconcile with the contracts' own totals, scan the chain instead. */
export async function readLedger(onProgress?: (done: number, total: number) => void): Promise<Ledger> {
  try {
    const fast = await readLedgerFrom("index", onProgress);
    if (fast.checks.every((c) => c.passed)) return fast;
  } catch {
    // Index unreachable, behind, or inconsistent: fall through to the trustless path.
  }
  return readLedgerFrom("chain", onProgress);
}

const INDEX_MAX_LAG = BigInt(200_000);

/** Raw logs from our coordinator's index, plus the un-indexed tail read straight from the chain. */
async function indexedLogs(logs: PublicClient, latest: bigint): Promise<Decoded[] | null> {
  const r = await fetch(`${config.coordinatorUrl}/chain/logs?from_block=${BASE_SEPOLIA.deployBlock}&limit=10000`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const body = (await r.json()) as { synced_to: number | null; logs: { address: string; topics: string[]; data: string; blockNumber: string; logIndex: string; transactionHash: string }[] };
  if (body.synced_to === null || latest - BigInt(body.synced_to) > INDEX_MAX_LAG) return null;
  const asLogs = body.logs.map((l) => ({ address: l.address, topics: l.topics, data: l.data, blockNumber: BigInt(l.blockNumber), logIndex: Number(BigInt(l.logIndex)), transactionHash: l.transactionHash, blockHash: null, transactionIndex: null, removed: false })) as unknown as Log[];
  const indexed = parseEventLogs({ abi: [...events, ...REGISTRY_EVENTS], logs: asLogs }) as unknown as Decoded[];
  const tail: Decoded[] = [];
  for (let from = BigInt(body.synced_to) + BigInt(1); from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - BigInt(1);
    tail.push(...((await logs.getLogs({ address: [BASE_SEPOLIA.escrow, BASE_SEPOLIA.registry], events: [...events, ...REGISTRY_EVENTS], fromBlock: from, toBlock: to > latest ? latest : to, strict: true })) as unknown as Decoded[]));
  }
  return [...indexed, ...tail];
}

async function readLedgerFrom(source: "index" | "chain", onProgress?: (done: number, total: number) => void): Promise<Ledger> {
  const { reads, logs } = chainClients();
  const [chainId, latest] = await Promise.all([reads.getChainId(), reads.getBlockNumber()]);
  if (chainId !== BASE_SEPOLIA.chainId) throw new Error("The RPC answered for a different chain.");

  const ranges: [bigint, bigint][] = [];
  for (let from = BASE_SEPOLIA.deployBlock; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - BigInt(1);
    ranges.push([from, to > latest ? latest : to]);
  }
  let raw: Decoded[] = [];
  const fromIndex = source === "index" ? await indexedLogs(logs, latest) : null;
  if (source === "index" && !fromIndex) throw new Error("index unavailable");
  if (fromIndex) {
    raw = fromIndex;
    onProgress?.(ranges.length, ranges.length);
  } else for (let i = 0; i < ranges.length; i += 4) {
    const batch = await Promise.all(
      ranges.slice(i, i + 4).map(([fromBlock, toBlock]) =>
        logs.getLogs({ address: [BASE_SEPOLIA.escrow, BASE_SEPOLIA.registry], events: [...events, ...REGISTRY_EVENTS], fromBlock, toBlock, strict: true }),
      ),
    );
    raw.push(...(batch.flat() as unknown as Decoded[]));
    onProgress?.(Math.min(i + 4, ranges.length), ranges.length);
  }

  const escrowEvents: EscrowEvent[] = [];
  let verifierSet: { verifiers: Hex[]; quorum: bigint; setId: number } | null = null;
  const listings = new Map<string, { wallet: Address; hash: Hex; block: bigint; tx: Hex; updates: number }>();
  for (const log of [...raw].sort((a, b) => Number((a.blockNumber ?? BigInt(0)) - (b.blockNumber ?? BigInt(0))) || (a.logIndex ?? 0) - (b.logIndex ?? 0))) {
    if (log.eventName === "ProviderRegistered" || log.eventName === "ProviderUpdated") {
      const a = log.args as { provider: Address; metadataHash: Hex };
      const prev = listings.get(a.provider.toLowerCase());
      listings.set(a.provider.toLowerCase(), {
        wallet: a.provider,
        hash: a.metadataHash,
        block: log.blockNumber ?? BigInt(0),
        tx: (log.transactionHash ?? "0x") as Hex,
        updates: prev ? prev.updates + 1 : 0,
      });
      continue;
    }
    const e = toEvent(log);
    if (!e) continue;
    if (e.kind === "verifiers") {
      if (!verifierSet || e.setId > verifierSet.setId) verifierSet = e;
    } else escrowEvents.push(e);
  }
  const sorted = sortEvents(escrowEvents);

  const at = { address: BASE_SEPOLIA.escrow, abi: escrowAbi } as const;
  const jobIds = [...new Set(sorted.filter((e) => "jobId" in e).map((e) => (e as { jobId: Hex }).jobId.toLowerCase() as Hex))];
  const [owner, coordinator, arbiter, setId, bond, totalLocked, totalWithdrawable, held, ...jobRows] = await Promise.all([
    reads.readContract({ ...at, functionName: "owner" }),
    reads.readContract({ ...at, functionName: "coordinator" }),
    reads.readContract({ ...at, functionName: "arbiter" }),
    reads.readContract({ ...at, functionName: "currentVerifierSet" }),
    reads.readContract({ ...at, functionName: "disputeBond" }),
    reads.readContract({ ...at, functionName: "totalLocked" }),
    reads.readContract({ ...at, functionName: "totalWithdrawable" }),
    reads.readContract({ address: BASE_SEPOLIA.usdc, abi: erc20, functionName: "balanceOf", args: [BASE_SEPOLIA.escrow] }),
    ...jobIds.map((jobId) => reads.readContract({ ...at, functionName: "getJob", args: [jobId] })),
  ]);
  const quorum = await reads.readContract({ ...at, functionName: "quorumOf", args: [setId] });

  const splits = new Map<string, JobSplit>();
  jobIds.forEach((jobId, i) => {
    const j = jobRows[i];
    splits.set(jobId, { client: j.client, budget: j.budget, arbiter: j.arbiter, payees: [...j.payees], amounts: [...j.amounts], refund: j.refund, state: j.state });
  });

  const book = buildBook(sorted, splits);

  // Every wallet the journal touches, read one by one from withdrawable().
  const wallets = new Set<Hex>(book.owedBy.keys());
  for (const s of splits.values()) {
    wallets.add(s.client.toLowerCase() as Hex);
    s.payees.forEach((p) => wallets.add(p.toLowerCase() as Hex));
  }
  const walletList = [...wallets];
  const owedNow = await Promise.all(walletList.map((w) => reads.readContract({ ...at, functionName: "withdrawable", args: [w] })));
  const withdrawableOf = new Map<Hex, bigint>();
  walletList.forEach((w, i) => owedNow[i] > BigInt(0) && withdrawableOf.set(w, owedNow[i]));

  // Block times and what each transaction cost in gas: a handful of calls for a handful of events.
  const blocks = [...new Set(sorted.map((e) => e.block))];
  const txs = [...new Set(sorted.map((e) => e.tx))];
  const [blockRows, receipts] = await Promise.all([
    Promise.all(blocks.map((b) => reads.getBlock({ blockNumber: b }))),
    Promise.all(txs.map((hash) => reads.getTransactionReceipt({ hash }))),
  ]);
  const times = new Map(blockRows.map((b) => [b.number.toString(), Number(b.timestamp) * 1000]));
  const costs = new Map<string, TxCost>(
    receipts.map((r) => [r.transactionHash.toLowerCase(), { tx: r.transactionHash, gasUsed: r.gasUsed, feeWei: r.gasUsed * r.effectiveGasPrice + (("l1Fee" in r && typeof r.l1Fee === "bigint") ? r.l1Fee : BigInt(0)), from: r.from }]),
  );

  const counters = { totalLocked, totalWithdrawable, held };
  const jobs: ChainJob[] = jobIds.map((jobId) => ({
    jobId,
    split: splits.get(jobId)!,
    events: sorted.filter((e) => "jobId" in e && (e as { jobId: Hex }).jobId.toLowerCase() === jobId),
  }));

  return {
    block: latest,
    readAt: Date.now(),
    roles: { owner, coordinator, arbiter, verifiers: verifierSet?.verifiers ?? [], quorum, setId, bond },
    counters,
    reserves: reserves(held, totalLocked, totalWithdrawable),
    jobs,
    events: sorted,
    book,
    withdrawableOf,
    checks: reconcile(book, counters, withdrawableOf),
    times,
    costs,
    logCalls: fromIndex ? 1 : ranges.length,
    source,
    registry: [...listings.values()],
  };
}

/** One wallet's position: USDC in the wallet, and what the escrow owes it. */
export async function readWallet(address: Address): Promise<{ usdc: bigint; owed: bigint; eth: bigint }> {
  const { reads } = chainClients();
  const [usdc, owed, eth] = await Promise.all([
    reads.readContract({ address: BASE_SEPOLIA.usdc, abi: erc20, functionName: "balanceOf", args: [address] }),
    reads.readContract({ address: BASE_SEPOLIA.escrow, abi: escrowAbi, functionName: "withdrawable", args: [address] }),
    reads.getBalance({ address }),
  ]);
  return { usdc, owed, eth };
}

export async function latestBlock(): Promise<bigint> {
  return chainClients().reads.getBlockNumber();
}

const withdrawAbi = parseAbi(["function withdraw()"]);

/** Sends escrow.withdraw() from the signed-in wallet. The wallet asks the person to confirm; nothing here holds a key. */
export async function withdrawFromEscrow(eth: import("viem").EIP1193Provider, account: Address): Promise<{ hash: Hex; ok: boolean }> {
  const { createWalletClient, custom } = await import("viem");
  const { baseSepolia } = await import("viem/chains");
  const wallet = createWalletClient({ chain: baseSepolia, transport: custom(eth) });
  if ((await wallet.getChainId()) !== baseSepolia.id) {
    try {
      await wallet.switchChain({ id: baseSepolia.id });
    } catch {
      await wallet.addChain({ chain: baseSepolia });
      await wallet.switchChain({ id: baseSepolia.id });
    }
  }
  const hash = await wallet.writeContract({ account, address: BASE_SEPOLIA.escrow, abi: withdrawAbi, functionName: "withdraw" });
  const receipt = await chainClients().reads.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return { hash, ok: receipt.status === "success" };
}
