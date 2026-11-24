import { describe, expect, it } from "vitest";
import { scrubTarget } from "./scrub";

const dur = 294_000; // the recorded run

describe("replay scrubber keys (ekido-ai/ekido-core#128)", () => {
  it("Home and End go to the start and the end", () => {
    expect(scrubTarget("Home", 120_000, dur)).toBe(0);
    expect(scrubTarget("End", 0, dur)).toBe(dur);
  });

  it("arrows step 5 s, both directions and both axes", () => {
    expect(scrubTarget("ArrowRight", 10_000, dur)).toBe(15_000);
    expect(scrubTarget("ArrowUp", 10_000, dur)).toBe(15_000);
    expect(scrubTarget("ArrowLeft", 10_000, dur)).toBe(5_000);
    expect(scrubTarget("ArrowDown", 10_000, dur)).toBe(5_000);
  });

  it("PageUp and PageDown step 30 s", () => {
    expect(scrubTarget("PageUp", 10_000, dur)).toBe(40_000);
    expect(scrubTarget("PageDown", 40_000, dur)).toBe(10_000);
  });

  it("stays inside the recording", () => {
    expect(scrubTarget("ArrowLeft", 2_000, dur)).toBe(0);
    expect(scrubTarget("PageUp", dur - 1_000, dur)).toBe(dur);
  });

  it("ignores other keys, so the page's own shortcuts still work", () => {
    expect(scrubTarget(" ", 0, dur)).toBeNull();
    expect(scrubTarget("]", 0, dur)).toBeNull();
    expect(scrubTarget("a", 0, dur)).toBeNull();
  });
});
