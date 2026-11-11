import { describe, expect, it } from "vitest";
import { budgetUnits } from "./escrow";

describe("escrow budget", () => {
  it("preserves all six USDC decimals", () => {
    expect(budgetUnits("1.000001")).toBe(BigInt(1000001));
    expect(budgetUnits("0.000001")).toBe(BigInt(1));
  });

  it("rejects values that would require rounding or are not positive", () => {
    for (const value of ["1.0000001", "0", "-1", "not a number"]) {
      expect(() => budgetUnits(value)).toThrow();
    }
  });
});
