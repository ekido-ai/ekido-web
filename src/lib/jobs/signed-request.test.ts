import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { checkFundingContext, checkRegisteredJob, documentHash, prepareSignedRequest } from "./signed-request";

const client = privateKeyToAccount(`0x${"1".repeat(64)}`);
const provider = privateKeyToAccount(`0x${"2".repeat(64)}`);
const contract = `0x${"a".repeat(40)}`;
const jobId = "12345678-1234-4234-8234-123456789abc";
const onchainId = documentHash({ job: jobId, client: client.address.toLowerCase() });

async function fixture() {
  const workload: Record<string, unknown> = {
    template: "distilbert-lora-agnews/v1",
    model: { revision: "a".repeat(40) },
    dataset: { revision: "b".repeat(40), fingerprint: "c".repeat(64), content_sha256: "c".repeat(64), test_content_sha256: "d".repeat(64) },
  };
  const quote = {
    kind: "gpuchain.provider_quote.v1", job_id: jobId, onchain_job_id: onchainId,
    chain_id: 31337, contract, provider_id: "p1", wallet: provider.address.toLowerCase(),
    price_per_step: "0.000001", workload_hash: documentHash(workload).slice(2),
  };
  const quoteSignature = await provider.signMessage({ message: { raw: documentHash(quote) } });
  workload.provider_terms = [{ provider_id: "p1", wallet: provider.address.toLowerCase(), price_per_step: "0.000001", quote: { ...quote, signature: quoteSignature } }];
  const policy = { min_accuracy: 0.9 };
  const binding = {
    kind: "gpuchain.job_binding.v1", job_id: jobId, onchain_job_id: onchainId,
    chain_id: 31337, contract, spec_hash: documentHash(workload).slice(2),
    policy_hash: documentHash(policy).slice(2), budget: "1.000001",
  };
  const signature = await client.signMessage({ message: { raw: documentHash(binding) } });
  return { job_id: jobId, client_address: client.address, workload, policy, budget_usdc: "1.000001", deadline_seconds: 3600, job_binding: { ...binding, signature } };
}

describe("offline signed request validation", () => {
  it("matches canonical hashes produced by the Python coordinator", () => {
    expect(documentHash({ job: jobId, client: "0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a" })).toBe("0x6169c5ccca921927cc6fd30e474e0a435ce595e3795e1c453416db7e23b0823d");
    expect(documentHash({ a: [1, 0.000001, "é"], z: { signature: "nested" }, signature: "outer" })).toBe("0x2c592b3ec9cac0e0e2d22aa7788870106cc7ba5707ea85f874c3d7023ea7ba14");
  });
  it("accepts matching client and provider signatures and preserves exact budget", async () => {
    const request = await fixture();
    const result = await prepareSignedRequest(JSON.stringify(request), 31337, contract);
    expect(result.onchainId).toBe(onchainId);
    expect(result.specHash).toBe(documentHash(request.workload));
    expect(result.body.budget_usdc).toBe("1.000001");
  });

  it("rejects changed policy, budget, chain and client", async () => {
    const request = await fixture();
    await expect(prepareSignedRequest(JSON.stringify({ ...request, policy: { min_accuracy: 0.8 } }), 31337, contract)).rejects.toThrow();
    await expect(prepareSignedRequest(JSON.stringify({ ...request, budget_usdc: "1.000002" }), 31337, contract)).rejects.toThrow();
    await expect(prepareSignedRequest(JSON.stringify(request), 84532, contract)).rejects.toThrow();
    await expect(prepareSignedRequest(JSON.stringify({ ...request, client_address: provider.address }), 31337, contract)).rejects.toThrow();
  });

  it("rejects a quote signed by another wallet even if the client signed the terms", async () => {
    const request = await fixture();
    const terms = request.workload.provider_terms as Array<{ quote: { signature: string } }>;
    terms[0].quote.signature = await client.signMessage({ message: { raw: documentHash(terms[0].quote) } });
    request.job_binding.spec_hash = documentHash(request.workload).slice(2);
    request.job_binding.signature = await client.signMessage({ message: { raw: documentHash(request.job_binding) } });
    await expect(prepareSignedRequest(JSON.stringify(request), 31337, contract)).rejects.toThrow("wrong wallet");
  });

  it("rejects secret material and unpinned model data", async () => {
    const request = await fixture();
    await expect(prepareSignedRequest(JSON.stringify({ ...request, private_key: "never paste keys" }), 31337, contract)).rejects.toThrow("private keys");
    (request.workload.model as { revision: string }).revision = "main";
    await expect(prepareSignedRequest(JSON.stringify(request), 31337, contract)).rejects.toThrow("pinned");
  });

  it("checks the coordinator response against locally computed job hashes", async () => {
    const prepared = await prepareSignedRequest(JSON.stringify(await fixture()), 31337, contract);
    const response = { job_id: jobId, onchain_id: prepared.onchainId, spec_hash: prepared.specHash.slice(2), policy_hash: prepared.policyHash.slice(2) };
    expect(() => checkRegisteredJob(prepared, response)).not.toThrow();
    for (const key of ["job_id", "onchain_id", "spec_hash", "policy_hash"]) {
      expect(() => checkRegisteredJob(prepared, { ...response, [key]: "wrong" })).toThrow("Do not fund");
    }
  });

  it("refuses funding from another wallet, chain, or escrow", async () => {
    const prepared = await prepareSignedRequest(JSON.stringify(await fixture()), 31337, contract);
    expect(() => checkFundingContext(prepared, client.address, 31337, contract)).not.toThrow();
    expect(() => checkFundingContext(prepared, provider.address, 31337, contract)).toThrow("connected wallet");
    expect(() => checkFundingContext(prepared, client.address, 84532, contract)).toThrow("chain or escrow");
    expect(() => checkFundingContext(prepared, client.address, 31337, `0x${"b".repeat(40)}`)).toThrow("chain or escrow");
  });
});
