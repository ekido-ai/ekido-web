import { describe, expect, it } from "vitest";
import { validDisputeWindow } from "./escrow";

describe("wallet dispute window", () => {
  it("allows short windows only for a local demo", () => {
    expect(validDisputeWindow(10, true)).toBe(true);
    expect(validDisputeWindow(3599, false)).toBe(false);
    expect(validDisputeWindow(3600, false)).toBe(true);
  });

  it("rejects invalid and out-of-range values for either chain", () => {
    for (const value of [0, -1, NaN, Infinity, 1.5, 604801]) {
      expect(validDisputeWindow(value, true)).toBe(false);
      expect(validDisputeWindow(value, false)).toBe(false);
    }
  });
});
