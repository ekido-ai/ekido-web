import { closeSync, existsSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPublicClient, http, parseAbi, type Hex } from "viem";
import { BASE_SEPOLIA } from "../../src/lib/chain/read";
import { REGISTRY_DEPLOY_BLOCK, REGISTRY_EVENTS } from "../../src/lib/chain/registry";

/**
 * Who the providers are, so the privacy test can look for them on public pages and in public API answers.
 *
 * - With EKIDO_OPERATOR_TOKEN, the coordinator's own /providers list: ids, names, wallets, keys and GPU models.
 * - Always, from Base Sepolia, which anyone can read: wallets registered in ProviderRegistry, and every escrow job's
 *   payees (the providers it paid or will pay).
 *
 * Without the token the test still catches wallets, GPU models, lists and counts, but can't know provider names.
 */
export interface Identities {
  /** Lower-case strings that identify one provider: ids, names, wallets, keys. */
  exact: Set<string>;
  /** Lower-case wallets, for matching shortened forms like 0x1c4d…337f. */
  wallets: Set<string>;
  /** GPU models the providers reported, e.g. "NVIDIA GeForce RTX 3060 Laptop GPU". */
  gpuModels: Set<string>;
  /** Where the identities came from, for the test report. */
  sources: string[];
}

type ProviderRow = {
  provider_id?: string;
  name?: string;
  wallet_address?: string;
  enrolled_key?: string | null;
  signing_keys?: string[];
  gpu_model?: string | null;
};

const LOG_RANGE = BigInt(50_000);
/** Identity strings shorter than this would match ordinary words, as in the coordinator's redactor (public_view.py). */
const MIN_LENGTH = 4;

async function fromOperator(coordinator: string, token: string, into: Identities) {
  const res = await fetch(`${coordinator}/providers`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GET /providers with the operator token answered ${res.status}`);
  const rows = (await res.json()) as ProviderRow[];
  for (const p of rows) {
    for (const v of [p.provider_id, p.name, p.wallet_address, p.enrolled_key, ...(p.signing_keys ?? [])]) {
      if (v && v.length >= MIN_LENGTH) into.exact.add(v.toLowerCase());
    }
    if (p.wallet_address) into.wallets.add(p.wallet_address.toLowerCase());
    if (p.gpu_model) into.gpuModels.add(p.gpu_model);
  }
  into.sources.push(`operator /providers (${rows.length} providers)`);
}

const CHAIN = parseAbi([
  "event JobCreated(bytes32 indexed jobId, address indexed client, uint256 budget, bytes32 specHash, bytes32 policyHash)",
  "struct Job { address client; uint64 deadline; uint8 state; uint32 verifierSet; uint64 disputeWindow; uint64 disputeEnd; uint64 disputedAt; bool passed; uint256 budget; uint256 bond; uint256 refund; bytes32 specHash; bytes32 policyHash; bytes32 finalCheckpoint; address[] payees; uint256[] amounts; address arbiter; }",
  "function getJob(bytes32 jobId) view returns (Job)",
  "function owner() view returns (address)",
  "function coordinator() view returns (address)",
  "function arbiter() view returns (address)",
]);
const PARALLEL = 4;

/**
 * One scan of the escrow's and the registry's history: registered providers, and every job's payees.
 * Payees that are the job's client or arbiter, or one of the escrow's own roles (owner, coordinator, arbiter), are
 * the operator or the customer, not a provider, so they are left out.
 */
async function fromChain(into: Identities) {
  const client = createPublicClient({ transport: http(BASE_SEPOLIA.logsRpc, { timeout: 20_000, retryCount: 5 }) });
  const latest = await client.getBlockNumber();
  const start = REGISTRY_DEPLOY_BLOCK < BASE_SEPOLIA.deployBlock ? REGISTRY_DEPLOY_BLOCK : BASE_SEPOLIA.deployBlock;
  const ranges: [bigint, bigint][] = [];
  for (let from = start; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - BigInt(1);
    ranges.push([from, to > latest ? latest : to]);
  }
  const registered = new Set<string>();
  const jobIds = new Set<Hex>();
  const t0 = Date.now();
  const progress = (what: string) => process.stderr.write(`[privacy] ${what} after ${Math.round((Date.now() - t0) / 1000)} s\n`);
  progress(`reading ${ranges.length} log ranges`);
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    if (i % 20 === 0) progress(`log range ${i} of ${ranges.length}`);
    const batch = await Promise.all(
      ranges.slice(i, i + PARALLEL).map(([fromBlock, toBlock]) =>
        client.getLogs({ address: [BASE_SEPOLIA.escrow, BASE_SEPOLIA.registry], events: [CHAIN[0], ...REGISTRY_EVENTS], fromBlock, toBlock, strict: true }),
      ),
    );
    for (const log of batch.flat()) {
      if (log.eventName === "JobCreated") jobIds.add(log.args.jobId);
      else registered.add(log.args.provider.toLowerCase());
    }
  }

  progress(`logs read: ${jobIds.size} jobs, ${registered.size} registered`);
  const at = { address: BASE_SEPOLIA.escrow, abi: CHAIN } as const;
  const roles = await Promise.all([
    client.readContract({ ...at, functionName: "owner" }),
    client.readContract({ ...at, functionName: "coordinator" }),
    client.readContract({ ...at, functionName: "arbiter" }),
  ]);
  const operator = new Set(roles.map((r) => r.toLowerCase()));
  const jobs = await Promise.all([...jobIds].map((jobId) => client.readContract({ ...at, functionName: "getJob", args: [jobId] })));
  progress("jobs read");
  const paid = new Set<string>();
  for (const job of jobs) {
    const notProvider = new Set([...operator, job.client.toLowerCase(), job.arbiter.toLowerCase()]);
    for (const p of job.payees) if (!notProvider.has(p.toLowerCase())) paid.add(p.toLowerCase());
  }

  for (const w of [...registered, ...paid]) {
    into.exact.add(w);
    into.wallets.add(w);
  }
  into.sources.push(`Base Sepolia: ${registered.size} registered in ProviderRegistry, ${paid.size} paid as providers by ${jobIds.size} escrow jobs`);
}

type Stored = { exact: string[]; wallets: string[]; gpuModels: string[]; sources: string[] };

/**
 * Loads the identities once per test run. Playwright runs several workers, and a fresh one after each failure; if each
 * read the chain's history, they'd hit the public RPC together and get rate-limited. So the first worker takes a lock
 * file and stores the result, and the others wait for it. Files are named after the run's parent process.
 */
export async function loadIdentities(coordinator: string): Promise<Identities> {
  const cache = join(tmpdir(), `ekido-privacy-identities-${process.ppid}.json`);
  const lock = `${cache}.lock`;
  let mine = false;
  try {
    closeSync(openSync(lock, "wx"));
    mine = true;
  } catch {
    // Another worker holds the lock and is loading.
  }
  if (!mine) {
    for (let waited = 0; !existsSync(cache); waited += 500) {
      if (waited > 170_000) throw new Error("timed out waiting for another worker to load the provider identities");
      if (!existsSync(lock)) return loadIdentities(coordinator); // that worker failed and released the lock: try ourselves
      await new Promise((r) => setTimeout(r, 500));
    }
    const s = JSON.parse(readFileSync(cache, "utf8")) as Stored;
    return { exact: new Set(s.exact), wallets: new Set(s.wallets), gpuModels: new Set(s.gpuModels), sources: s.sources };
  }
  try {
    if (existsSync(cache)) {
      const s = JSON.parse(readFileSync(cache, "utf8")) as Stored;
      return { exact: new Set(s.exact), wallets: new Set(s.wallets), gpuModels: new Set(s.gpuModels), sources: s.sources };
    }
    const ids: Identities = { exact: new Set(), wallets: new Set(), gpuModels: new Set(), sources: [] };
    const token = process.env.EKIDO_OPERATOR_TOKEN;
    if (token) await fromOperator(coordinator, token, ids);
    else ids.sources.push("no EKIDO_OPERATOR_TOKEN, so provider names are not checked");
    await fromChain(ids);
    const stored: Stored = { exact: [...ids.exact], wallets: [...ids.wallets], gpuModels: [...ids.gpuModels], sources: ids.sources };
    writeFileSync(`${cache}.tmp`, JSON.stringify(stored));
    renameSync(`${cache}.tmp`, cache);
    return ids;
  } finally {
    rmSync(lock, { force: true });
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every known identity in `text`, full or shortened (0x1c4d…337f, 0x1c4d...337f). */
export function identitiesIn(text: string, ids: Identities): string[] {
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const id of ids.exact) {
    if (new RegExp(`(^|[^a-z0-9_])${escape(id)}(?![a-z0-9_])`).test(lower)) hits.add(id);
  }
  for (const m of lower.matchAll(/0x([0-9a-f]{2,})(?:…|\.\.\.)([0-9a-f]{3,})/g)) {
    for (const w of ids.wallets) if (w.startsWith(`0x${m[1]}`) && w.endsWith(m[2])) hits.add(`${m[0]} (${w})`);
  }
  return [...hits];
}
