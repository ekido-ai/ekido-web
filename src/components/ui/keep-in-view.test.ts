import { describe, expect, it } from "vitest";
import { clampShift } from "./keep-in-view";

describe("clampShift: popups stay on screen (ekido-ai/ekido-core#124)", () => {
  it("leaves a popup that fits alone", () => {
    expect(clampShift(900, 352, 1366)).toBe(0);
  });

  it("moves a popup that runs off the left edge back in (the wallet menu at 390 px)", () => {
    // Measured on staging: x = -178 at 390 px wide.
    expect(clampShift(-178, 352, 390)).toBe(194);
    expect(-178 + 194).toBe(16);
  });

  it("moves a popup that runs off the right edge back in", () => {
    expect(clampShift(300, 288, 412)).toBe(-192);
    expect(300 + 288 - 192).toBe(412 - 16);
  });

  it("pins a popup wider than the room to the left margin", () => {
    expect(clampShift(-50, 400, 360)).toBe(66);
  });

  it("respects a custom margin", () => {
    expect(clampShift(2, 100, 400, 8)).toBe(6);
  });
});
