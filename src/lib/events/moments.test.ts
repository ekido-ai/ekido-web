import { describe, expect, it } from "vitest";
import realRun from "../../../replay/recordings/real-run-2026-11-04.json";
import { recordingFromRealRun, type RealRecording } from "../live/translate";
import { momentsOf } from "./moments";

describe("key moments on the real 4 Nov run", () => {
  it("finds the kill, the refusal, both resumes, completion and payment, in order", () => {
    const m = momentsOf(recordingFromRealRun(realRun as unknown as RealRecording, "5").events);
    expect(m.map((x) => x.kind)).toEqual(["lost", "resumed", "refused", "resumed", "done", "paid"]);
    expect(Math.round(m[0].offsetMs / 1000)).toBe(29);
    expect(Math.round(m[2].offsetMs / 1000)).toBe(123);
    expect(Math.round(m[5].offsetMs / 1000)).toBe(248);
  });
});
