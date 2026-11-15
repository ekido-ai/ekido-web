import { describe, expect, it } from "vitest";
import { canonical, compareListings, metadataHash, priceMicros, providerMetadata } from "./registry";

// Same vector as packages/ekido_core/tests/test_provider_meta.py.
const VECTOR_JSON = '{"capacity_mib":8192,"kind":"gpuchain.provider_meta.v1","name":"Vaibhav RTX 4060","price_per_step_micros":4,"wallet":"0x00000000000000000000000000000000000000aa"}';
const VECTOR_HASH = "0xdcc849bbc2c814ba36af7908f5819b6ce78a178de6fe82a02f0dcce1fc51ef11";
const W = "0x00000000000000000000000000000000000000AA" as const;

describe("provider metadata", () => {
  it("matches the Python bytes and hash exactly", () => {
    const meta = providerMetadata("Vaibhav RTX 4060", W, "0.000004", 8192)!;
    expect(canonical(meta)).toBe(VECTOR_JSON);
    expect(metadataHash(meta)).toBe(VECTOR_HASH);
  });

  it("reads the coordinator's padded price the same as the provider's", () => {
    expect(priceMicros("0.002000")).toBe(2000);
    expect(priceMicros("0.002")).toBe(2000);
    expect(priceMicros("1")).toBe(1_000_000);
    expect(priceMicros("0")).toBeNull();
    expect(priceMicros("0.0000001")).toBeNull();
    expect(priceMicros("abc")).toBeNull();
  });
});

describe("comparing the chain with the coordinator", () => {
  const hash = metadataHash(providerMetadata("Vaibhav RTX 4060", W, "0.000004", 8192)!);
  const onchain = [{ wallet: W, hash, block: BigInt(1), tx: "0x01" as const, updates: 0 }];

  it("matches when the coordinator shows the committed terms", () => {
    const r = compareListings(onchain, [{ name: "Vaibhav RTX 4060", wallet_address: W.toLowerCase(), price_per_step: "0.000004", capacity_mib: 8192 }]);
    expect(r.listings[0].status).toBe("matches");
    expect(r.offChainOnly).toBe(0);
  });

  it("flags a coordinator that changed the price", () => {
    const r = compareListings(onchain, [{ name: "Vaibhav RTX 4060", wallet_address: W, price_per_step: "0.000009", capacity_mib: 8192 }]);
    expect(r.listings[0].status).toBe("differs");
  });

  it("flags a provider the coordinator hides, and counts off-chain-only ones", () => {
    const r = compareListings(onchain, [{ name: "Other", wallet_address: "0x" + "b".repeat(40), price_per_step: "0.000001", capacity_mib: null }]);
    expect(r.listings[0].status).toBe("not-listed");
    expect(r.offChainOnly).toBe(1);
  });
});
