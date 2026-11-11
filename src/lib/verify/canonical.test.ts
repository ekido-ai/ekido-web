import { describe, expect, it } from "vitest";
import { canonicalJson, documentHash, feeTerms } from "./canonical";

describe("canonical JSON", () => {
  it("matches the Python document hash byte for byte", async () => {
    const doc = { z: 1, a: [1.5, 2, { b: 0.0005, a: "xé" }], lr: 0.0005, n: null, t: true, signature: "0xab" };
    expect(canonicalJson({ ...doc, signature: undefined })).toBe('{"a":[1.5,2,{"a":"xé","b":0.0005}],"lr":0.0005,"n":null,"t":true,"z":1}');
    expect(await documentHash(doc)).toBe("eb5c4b192ecc33c983546bf5731353a5f2e6171c292c65196c1882607c413f62");
  });

  it("reads fee terms only when they are well formed", () => {
    expect(feeTerms({ protocol_fee: { bps: 800, recipient: "0xAB" } })).toEqual({ bps: 800, recipient: "0xab" });
    expect(feeTerms({})).toBeNull();
    expect(feeTerms({ protocol_fee: { bps: "800", recipient: "0xab" } })).toBeNull();
  });
});
