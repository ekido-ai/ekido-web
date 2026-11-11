import { createPublicClient, decodeFunctionData, http, parseAbi, recoverAddress } from "viem";
import { config } from "../config";
import { fromMicros } from "../receipt/receipt";
import { documentHash, feeTerms } from "./canonical";
import { expectedPayouts, lineageOf, lineageRoot, stepsBySigner, type CheckpointRow, type ProviderTerms } from "./payout";

const abi = parseAbi([
  "struct Verdict { bytes32 jobId; bool passed; bytes32 finalCheckpoint; bytes32 lineageRoot; bytes32 qualityReport; address[] payees; uint256[] amounts; uint256 refund; uint64 expiry; }",
  "struct Job { address client; uint64 deadline; uint8 state; uint32 verifierSet; uint64 disputeWindow; uint64 disputeEnd; uint64 disputedAt; bool passed; uint256 budget; uint256 bond; uint256 refund; bytes32 specHash; bytes32 policyHash; bytes32 finalCheckpoint; address[] payees; uint256[] amounts; address arbiter; }",
  "function submitAttestation(Verdict verdict, bytes[] signatures)",
  "function hashVerdict(Verdict v) view returns (bytes32)",
  "function isVerifier(uint32 setId, address verifier) view returns (bool)",
  "function quorumOf(uint32 setId) view returns (uint256)",
  "function getJob(bytes32 jobId) view returns (Job)",
]);

const STATES = ["None", "Funded", "Active", "Attested", "Disputed", "Settled", "Refunded", "Cancelled"];

export interface CheckRow {
  title: string;
  passed: boolean;
  detail: string;
  /** Where this fact came from. The chain is the part nobody here can edit. */
  source: "chain" | "recomputed" | "coordinator";
}

export interface VerifyResult {
  rows: CheckRow[];
  escrow: string;
  txHash: string;
  explorer: string | null;
  steps: { step: number; hash: string }[];
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(config.coordinatorUrl + path, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`The coordinator answered ${response.status} for ${path}`);
  return (await response.json()) as T;
}

const bare = (value: string) => value.toLowerCase().replace(/^0x/, "");
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const usdc = (units: bigint) => fromMicros(units).replace(/0+$/, "").replace(/\.$/, ".0");

/**
 * Reads the verdict from the transaction on the chain, not from the coordinator, then re-derives what it can.
 * A local chain is read at its usual local address, and Base Sepolia at the configured RPC.
 */
export async function verifyPayout(jobId: string, localChain: boolean): Promise<VerifyResult> {
  const id = encodeURIComponent(jobId);
  const [settlement, job, rows, providers] = await Promise.all([
    json<{ status: string; submit_tx: string | null }>(`/jobs/${id}/settlement`),
    json<{ onchain_id: `0x${string}`; spec_hash: string; policy_hash: string; spec?: Record<string, unknown> }>(`/jobs/${id}`),
    json<CheckpointRow[]>(`/jobs/${id}/checkpoints`),
    json<ProviderTerms[]>("/providers"),
  ]);
  if (!settlement.submit_tx) throw new Error("This job has no attestation on-chain yet.");

  const client = createPublicClient({ transport: http(localChain ? "http://127.0.0.1:8545" : config.rpcUrl) });
  const expectedChainId = localChain ? 31337 : config.chainId;
  if (await client.getChainId() !== expectedChainId) throw new Error("The RPC is connected to a different chain.");
  const hash = (settlement.submit_tx.startsWith("0x") ? settlement.submit_tx : `0x${settlement.submit_tx}`) as `0x${string}`;
  const [tx, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
  if (!tx.to) throw new Error("The transaction has no contract destination.");
  const escrow = tx.to as `0x${string}`;
  const decoded = decodeFunctionData({ abi, data: tx.input });
  if (decoded.functionName !== "submitAttestation") throw new Error("That transaction isn't an attestation.");
  const [verdict, signatures] = decoded.args;
  const onchainId = `0x${bare(job.onchain_id)}` as `0x${string}`;
  const onchain = await client.readContract({ address: escrow, abi, functionName: "getJob", args: [onchainId] });

  const out: CheckRow[] = [];
  const add = (title: string, passed: boolean, detail: string, source: CheckRow["source"]) => out.push({ title, passed, detail, source });

  add("Escrow matches the configured address", !!config.escrowAddress && bare(config.escrowAddress) === bare(escrow), config.escrowAddress ? `Configured ${short(config.escrowAddress)}; transaction destination ${short(escrow)}` : "No trusted escrow address is configured, so its identity could not be checked.", "recomputed");
  add("The attestation transaction succeeded", receipt.status === "success", `Block ${receipt.blockNumber}, sent to the escrow ${short(escrow)}`, "chain");
  add("It's for this job", bare(verdict.jobId) === bare(onchainId), `Job ${short(onchainId)}`, "chain");
  add("The escrow finalized the payouts", STATES[onchain.state] === "Settled", `Escrow state: ${STATES[onchain.state]}`, "chain");
  add(
    "Coordinator terms match the escrow hashes",
    bare(onchain.specHash) === bare(job.spec_hash) && bare(onchain.policyHash) === bare(job.policy_hash),
    `Job spec ${short(onchain.specHash)} and quality policy ${short(onchain.policyHash)}, fixed when the budget was locked`,
    "recomputed",
  );

  // Who really signed, recovered from the signatures themselves.
  const digest = await client.readContract({ address: escrow, abi, functionName: "hashVerdict", args: [verdict] });
  const [signers, quorum] = await Promise.all([Promise.all(signatures.map((signature) => recoverAddress({ hash: digest, signature }))), client.readContract({ address: escrow, abi, functionName: "quorumOf", args: [onchain.verifierSet] })]);
  const allowed = await Promise.all(signers.map((verifier) => client.readContract({ address: escrow, abi, functionName: "isVerifier", args: [onchain.verifierSet, verifier] })));
  add(
    "Enough registered verifiers signed this exact verdict",
    allowed.every(Boolean) && new Set(signers).size === signers.length && BigInt(signers.length) >= quorum,
    `${signers.length} signed, quorum is ${quorum}: ${signers.map(short).join(", ")}`,
    "recomputed",
  );

  // The checkpoint chain the payout rests on, re-walked and re-hashed here.
  const chain = lineageOf(rows, verdict.finalCheckpoint);
  const recomputedRoot = lineageRoot(chain.map((row) => row.manifest_hash));
  add("Signed lineage root matches the supplied checkpoint hashes", recomputedRoot.toLowerCase() === verdict.lineageRoot.toLowerCase(), `${chain.length} checkpoints, root ${short(recomputedRoot)}`, "recomputed");
  add("Supplied steps increase along the chain", chain.every((row, i) => i === 0 || row.logical_step > chain[i - 1].logical_step), `Step ${chain[0].logical_step} to step ${chain.at(-1)?.logical_step}`, "recomputed");
  add("The final checkpoint on-chain is the end of that chain", onchain.finalCheckpoint.toLowerCase() === verdict.finalCheckpoint.toLowerCase(), short(onchain.finalCheckpoint), "chain");

  // The payout, worked out again from steps and each provider's price.
  // Fee terms count only if the spec they sit in hashes to what the client funded on-chain.
  const specHash = job.spec ? await documentHash(job.spec) : null;
  const specIsFunded = !!specHash && bare(onchain.specHash) === specHash;
  const fee = specIsFunded ? feeTerms(job.spec) : null;
  add(
    "The job terms shown are the ones the client funded",
    specIsFunded,
    specIsFunded ? `Your browser hashed the spec to ${short("0x" + specHash)}, the escrow's specHash${fee ? `, including a ${fee.bps / 100}% fee to ${short(fee.recipient)}` : ", with no protocol fee"}` : "The coordinator's spec doesn't hash to the funded specHash, so its terms can't be trusted.",
    "recomputed",
  );
  const expected = expectedPayouts(stepsBySigner(chain), providers, onchain.budget, fee);
  const paid = new Map(verdict.payees.map((payee, i) => [payee.toLowerCase(), verdict.amounts[i]]));
  const samePayout = expected.size === paid.size && [...expected].every(([wallet, amount]) => paid.get(wallet) === amount);
  add("Payout matches the supplied steps and prices", samePayout, verdict.payees.map((payee, i) => `${short(payee)} gets ${usdc(verdict.amounts[i])} USDC`).join(". "), "recomputed");

  const chainPayees = onchain.payees.map((p) => p.toLowerCase());
  const signedPayees = verdict.payees.map((p) => p.toLowerCase());
  const finalSplitMatches = chainPayees.length === signedPayees.length
    && chainPayees.every((p, i) => p === signedPayees[i] && onchain.amounts[i] === verdict.amounts[i])
    && onchain.amounts.length === verdict.amounts.length && onchain.refund === verdict.refund;
  add("Final on-chain split matches the signed verdict", finalSplitMatches,
    finalSplitMatches ? "The stored final payees, amounts and client refund match the attestation." : "The stored split differs from the attestation; a dispute or another change may have altered it.", "chain");

  const paidTotal = verdict.amounts.reduce((sum, amount) => sum + amount, BigInt(0));
  add("Payouts plus the refund equal the budget", paidTotal + verdict.refund === onchain.budget, `${usdc(paidTotal)} paid + ${usdc(verdict.refund)} refunded = ${usdc(onchain.budget)} USDC`, "recomputed");

  return {
    rows: out,
    escrow,
    txHash: hash,
    explorer: localChain ? null : config.explorer ? `${config.explorer}/tx/${hash}` : null,
    steps: chain.map((row) => ({ step: row.logical_step, hash: row.manifest_hash })),
  };
}
