import { describe, expect, it } from "vitest";
import sample from "../../../replay/recordings/sample-demo.json";
import { reduceAll } from "./reduce";
import type { Recording } from "./types";
import { compileAttempts, configChanges, qualityRows, qualitySentence, settlementView } from "./views";

const rec = sample as Recording;
const end = reduceAll(rec.events);

describe("compileAttempts", () => {
  const [first, second] = compileAttempts(end);

  it("groups decisions per recovery attempt", () => {
    expect(first.rows.map((r) => r.providerId)).toEqual(["P"]);
    expect(second.rows.map((r) => [r.providerId, r.verdict])).toEqual([
      ["C", "rejected"],
      ["B", "accepted"],
    ]);
  });

  it("measures B's probe against B's cap, not the whole GPU", () => {
    const b = second.rows.find((r) => r.providerId === "B")!;
    expect(b.capacityMib).toBe(3072);
    expect(b.peakFrac).toBeCloseTo(2580 / 3072);
    expect(b.logicalBatchKept).toBe(true);
  });

  it("lists exactly what changed", () => {
    const b = second.rows.find((r) => r.providerId === "B")!;
    expect(configChanges(b.from, b.to).map((c) => c.field)).toEqual(["Micro-batch", "Accumulation"]);
  });
});

describe("quality", () => {
  const rows = qualityRows(end);

  it("joins each result to its checkpoint", () => {
    const p = rows.find((r) => r.verdict === "reject")!;
    expect(p.providerId).toBe("P");
    expect(p.step).toBe(150);
    expect(p.ciLower).toBeLessThan(-p.margin);
  });

  it("every pass is inside the margin and every reject outside", () => {
    for (const r of rows) expect(r.verdict === "pass").toBe(r.ciLower >= -r.margin);
  });

  it("explains the verdict in words", () => {
    const p = rows.find((r) => r.verdict === "reject")!;
    expect(qualitySentence(p)).toMatch(/rejected/);
    expect(qualitySentence(rows[0])).toMatch(/passes/);
  });
});

describe("settlementView", () => {
  it("is null before settlement", () => {
    expect(settlementView(reduceAll(rec.events.slice(0, 50)))).toBeNull();
  });

  it("balances to the budget and leaves P out of the split", () => {
    const v = settlementView(end)!;
    expect(v.balanced).toBe(true);
    expect(v.parts.map((p) => p.key)).toEqual(["A", "B", "refund"]);
    expect(v.parts.reduce((a, p) => a + p.frac, 0)).toBeCloseTo(1);
    expect(v.zeroPaid[0].providerId).toBe("P");
  });
});
