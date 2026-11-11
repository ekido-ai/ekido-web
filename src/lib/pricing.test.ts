import { describe, expect, it } from "vitest";
import { GPU_CLASSES, clientHourly, perStepPrice, suggestedHourly } from "./pricing";

describe("pricing", () => {
  it("converts an hourly rate to whole micro-USDC per step", () => {
    // 0.085 USDC/h at 12 steps/s is 1.97 micro-USDC a step, which rounds to 2.
    expect(perStepPrice(0.085, 12)).toEqual({ price: "0.000002", micros: 2, effectiveHourly: 0.0864 });
    expect(perStepPrice(36, 10)?.price).toBe("0.001");
  });

  it("never prices a step at zero, and refuses nonsense", () => {
    expect(perStepPrice(0.0001, 1000)?.micros).toBe(1);
    expect(perStepPrice(0, 12)).toBeNull();
    expect(perStepPrice(0.1, 0)).toBeNull();
    expect(perStepPrice(Number.NaN, 12)).toBeNull();
  });

  it("keeps the client's total, fee included, below the market rate", () => {
    for (const c of GPU_CLASSES) {
      const total = clientHourly(suggestedHourly(c));
      expect(total).toBeLessThan(c.marketHourly);
      expect(total).toBeGreaterThan(c.marketHourly * 0.85);
    }
  });
});
