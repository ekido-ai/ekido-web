import { isAddress, isHex, recoverMessageAddress, sha256, size, stringToHex, type Hex } from "viem";
import { toMicros } from "../receipt/receipt";

type Obj = Record<string, unknown>;
export interface SignedRequest {
  job_id: string;
  client_address: string;
  workload: Obj;
  policy: Obj;
  budget_usdc: string;
  deadline_seconds: number;
  job_binding: Obj;
}
export interface PreparedSignedRequest {
  body: SignedRequest;
  specHash: Hex;
  policyHash: Hex;
  onchainId: Hex;
}

function object(value: unknown, label: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Obj;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error("A number in the request is unsafe.");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)) throw new Error("Invalid Unicode in the request.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const v = object(value, "Request value");
  return `{${Object.keys(v).sort().map((key) => `${canonical(key)}:${canonical(v[key])}`).join(",")}}`;
}

/** The coordinator hashes top-level documents without their signature fields. */
export function documentHash(value: Obj): Hex {
  const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "signature" && key !== "sig"));
  return sha256(stringToHex(canonical(body)));
}

function noSecrets(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(noSecrets); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (/private.?key|mnemonic|password|secret/i.test(key)) throw new Error("Remove private keys, passwords and secrets from the request.");
    noSecrets(entry);
  }
}

async function verifySignature(doc: Obj, signer: string): Promise<void> {
  const signature = doc.signature;
  if (typeof signature !== "string" || !isHex(signature) || size(signature) !== 65) throw new Error("A required signature is missing or malformed.");
  let recovered: string;
  try { recovered = await recoverMessageAddress({ message: { raw: documentHash(doc) }, signature }); }
  catch { throw new Error("A signed document could not be verified."); }
  if (recovered.toLowerCase() !== signer.toLowerCase()) throw new Error("A document was signed by the wrong wallet.");
}

const equal = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label} does not match the signed terms.`);
};

/** Validate offline-collected EOA-signed terms independently before registration or funding. */
export async function prepareSignedRequest(text: string, chainId: number, escrow: string | null): Promise<PreparedSignedRequest> {
  if (text.length > 250_000) throw new Error("Signed request is too large.");
  if (!escrow || !isAddress(escrow)) throw new Error("Configure a trusted escrow address first.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("Enter valid JSON."); }
  const request = object(parsed, "Signed request");
  noSecrets(request);
  const keys = ["job_id", "client_address", "workload", "policy", "budget_usdc", "deadline_seconds", "job_binding"];
  if (Object.keys(request).some((key) => !keys.includes(key)) || keys.some((key) => !(key in request))) throw new Error("Signed request fields are incomplete or unexpected.");
  const { job_id: jobId, client_address: client, budget_usdc: budget, deadline_seconds: deadline } = request;
  if (typeof jobId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(jobId)) throw new Error("A canonical UUIDv4 job ID is required.");
  if (typeof client !== "string" || !isAddress(client)) throw new Error("A valid client address is required.");
  if (typeof budget !== "string" || toMicros(budget) <= BigInt(0)) throw new Error("A positive budget string with at most 6 decimals is required.");
  if (!Number.isSafeInteger(deadline) || (deadline as number) < 1 || (deadline as number) > 604800) throw new Error("Deadline must be 1–604800 seconds.");
  const workload = object(request.workload, "Workload");
  const policy = object(request.policy, "Policy");
  const binding = object(request.job_binding, "Client binding");
  if (workload.template !== "distilbert-lora-agnews/v1" && workload.template !== "synthetic-linear/v1") throw new Error("This workload is not supported by the signed job flow.");
  if (workload.template === "distilbert-lora-agnews/v1") {
    const model = object(workload.model, "Model");
    const dataset = object(workload.dataset, "Dataset");
    const commit = (v: unknown) => typeof v === "string" && /^[0-9a-f]{40}$/.test(v) && !/^0+$/.test(v);
    const digest = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v) && !/^0+$/.test(v);
    if (!commit(model.revision) || !commit(dataset.revision) || !digest(dataset.content_sha256) || !digest(dataset.test_content_sha256) || dataset.fingerprint !== dataset.content_sha256) throw new Error("The model and dataset identities must be pinned before funding.");
  }
  const onchainId = documentHash({ job: jobId, client: client.toLowerCase() });
  const specHash = documentHash(workload);
  const policyHash = documentHash(policy);
  const expected = { kind: "gpuchain.job_binding.v1", job_id: jobId, onchain_job_id: onchainId, chain_id: chainId, contract: escrow.toLowerCase(), spec_hash: specHash.slice(2), policy_hash: policyHash.slice(2) };
  for (const [key, value] of Object.entries(expected)) equal(binding[key], value, `Client binding ${key}`);
  if (typeof binding.budget !== "string" || toMicros(binding.budget) !== toMicros(budget)) throw new Error("Budget does not match the client binding.");
  await verifySignature(binding, client);
  const terms = workload.provider_terms;
  if (!Array.isArray(terms) || terms.length < 1 || terms.length > 256) throw new Error("At least one signed provider quote is required.");
  const { provider_terms: _terms, ...withoutTerms } = workload;
  void _terms;
  const workloadHash = documentHash(withoutTerms).slice(2);
  const seen = new Set<string>();
  for (const entry of terms) {
    const term = object(entry, "Provider term");
    const quote = object(term.quote, "Provider quote");
    const id = term.provider_id, wallet = term.wallet, rate = term.price_per_step;
    if (typeof id !== "string" || !id || id.length > 128 || seen.has(id) || typeof wallet !== "string" || !isAddress(wallet) || typeof rate !== "string" || toMicros(rate) < BigInt(0)) throw new Error("Invalid or duplicate provider terms.");
    seen.add(id);
    const expectedQuote = { kind: "gpuchain.provider_quote.v1", job_id: jobId, onchain_job_id: onchainId, chain_id: chainId, contract: escrow.toLowerCase(), provider_id: id, wallet: wallet.toLowerCase(), workload_hash: workloadHash };
    for (const [key, value] of Object.entries(expectedQuote)) equal(quote[key], value, `Provider quote ${key}`);
    if (typeof quote.price_per_step !== "string" || toMicros(quote.price_per_step) !== toMicros(rate)) throw new Error("Provider price does not match the signed quote.");
    await verifySignature(quote, wallet);
  }
  return { body: request as unknown as SignedRequest, specHash, policyHash, onchainId };
}

/** Refuse to fund if the coordinator registered anything other than the locally verified terms. */
export function checkRegisteredJob(prepared: PreparedSignedRequest, response: unknown): void {
  const job = object(response, "Coordinator response");
  const matchesHash = (actual: unknown, expected: Hex) =>
    typeof actual === "string" && actual.replace(/^0x/i, "").toLowerCase() === expected.slice(2).toLowerCase();
  if (job.job_id !== prepared.body.job_id || !matchesHash(job.onchain_id, prepared.onchainId)
      || !matchesHash(job.spec_hash, prepared.specHash) || !matchesHash(job.policy_hash, prepared.policyHash)) {
    throw new Error("Coordinator response does not match the signed job. Do not fund it.");
  }
}

/** Recheck immediately before any approval or funding transaction. */
export function checkFundingContext(prepared: PreparedSignedRequest, wallet: string, chainId: number, escrow: string): void {
  const binding = prepared.body.job_binding;
  if (!isAddress(wallet) || wallet.toLowerCase() !== prepared.body.client_address.toLowerCase()) {
    throw new Error("The connected wallet is not the client who signed this job.");
  }
  if (binding.chain_id !== chainId || !isAddress(escrow) || binding.contract !== escrow.toLowerCase()) {
    throw new Error("The wallet chain or escrow does not match the signed job.");
  }
}
