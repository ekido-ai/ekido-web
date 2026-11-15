import { describe, expect, it } from "vitest";
import real from "../../../replay/recordings/real-run.json";
import sample from "../../../replay/recordings/sample-demo.json";
import { recordingTruth } from "./truth";
import { recordingFromRealRun, type RealRecording } from "../live/translate";

describe("recordingTruth", () => {
  it("live data never gets the recorded or sample badge", () => {
    expect(recordingTruth("live")).toBeNull();
  });

  it("a recording is labelled RECORDED and sample data SAMPLE", () => {
    expect(recordingTruth("recorded")).toBe("RECORDED");
    expect(recordingTruth("sample")).toBe("SAMPLE");
  });

  it("the shipped recordings carry a provenance that gets a badge", () => {
    const realRun = recordingFromRealRun(real as unknown as RealRecording, "1.00");
    expect(recordingTruth(realRun.provenance)).toBe("RECORDED");
    expect(recordingTruth((sample as { provenance: "sample" | "recorded" }).provenance)).toBe("SAMPLE");
  });
});
