import { describe, expect, it } from "vitest";
import type { Identities } from "./identities";
import { assertRedacted, tag } from "./redact";
import { pageFindings, scanJson } from "./scan";

// A made-up provider. The test fails if any of these values appears in a finding.
const NAME = "rahul-gaming-rig";
const WALLET = "0x1c4d04718d0fe1fcb23052ccee2fe5d2d8fc337f";
const KEY = "ed25519:9f8e7d6c5b4a39281706f5e4d3c2b1a0";
const GPU = "NVIDIA GeForce RTX 3080 Ti";
const ids: Identities = {
  exact: new Set([NAME, WALLET, KEY]),
  wallets: new Set([WALLET]),
  gpuModels: new Set([GPU]),
  sources: ["test"],
};
const SECRETS = [NAME, WALLET, KEY, GPU, WALLET.slice(0, 6), "3 providers", "rtx 3080"];

function expectNoSecret(findings: string[]) {
  const text = findings.join("\n").toLowerCase();
  for (const s of SECRETS) expect(text, `finding shows "${s}"`).not.toContain(s.toLowerCase());
}

describe("privacy findings never contain the value they are about", () => {
  it("tags are one-way, short and stable", () => {
    expect(tag(WALLET)).toMatch(/^sha256 [0-9a-f]{6}$/);
    expect(tag(WALLET)).toBe(tag(WALLET.toUpperCase()));
    expect(tag(NAME)).not.toBe(tag(WALLET));
  });

  it("API answers: unredacted identities, hardware and names in text", () => {
    const answer = {
      jobs: [{ provider_id: NAME, wallet_address: WALLET, payees: [WALLET], gpu_model: GPU, note: `paid ${NAME} for steps` }],
      provider_count: 3,
    };
    const found = scanJson(answer, ids, "GET /jobs/x");
    expect(found.length).toBeGreaterThanOrEqual(5);
    expectNoSecret(found);
    expect(found.join("\n")).toContain(`(operator identity, ${tag(NAME)})`);
    expect(found.join("\n")).toContain("gives away hardware (string, sha256");
    expect(() => assertRedacted(found, ids.exact)).not.toThrow();
  });

  it("pages: full and shortened wallets, GPU models, counts and provider lists", () => {
    const shortened = `${WALLET.slice(0, 6)}…${WALLET.slice(-4)}`;
    const found = pageFindings(
      {
        html: `<a title="${WALLET}">${shortened}</a> <span>${NAME}</span>`,
        text: `${shortened} runs on ${GPU}. 3 providers online.`,
        headings: ["Providers, as they committed themselves"],
      },
      ids,
    );
    expect(found).toEqual(
      expect.arrayContaining([
        `names a provider (wallet, ${tag(WALLET)})`,
        `names a provider (wallet (shortened), ${tag(WALLET)})`,
        `names a provider (operator identity, ${tag(NAME)})`,
        `provider list: heading (${tag("Providers, as they committed themselves")})`,
      ]),
    );
    expect(found.some((f) => f.startsWith("GPU model (sha256 "))).toBe(true);
    expect(found.some((f) => f.startsWith("provider count (sha256 "))).toBe(true);
    expectNoSecret(found);
    expect(() => assertRedacted(found, ids.exact)).not.toThrow();
  });

  it("the last check stops a leaked value without printing it", () => {
    const leaky = [`names a provider (${WALLET})`];
    expect(() => assertRedacted(leaky, ids.exact)).toThrow(/were not redacted/);
    try {
      assertRedacted(leaky, ids.exact);
    } catch (e) {
      expect(String(e)).not.toContain(WALLET);
    }
    expect(() => assertRedacted([`see ${WALLET.slice(0, 6)}…${WALLET.slice(-4)}`], ids.exact)).toThrow();
  });
});
