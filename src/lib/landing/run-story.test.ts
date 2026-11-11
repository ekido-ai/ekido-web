import { describe, expect, it } from "vitest";
import { segments, ticker } from "./run-story";

describe("landing run story (from the real 4 Nov recording)", () => {
  it("has the three training stretches in order, with how each ended", () => {
    expect(segments.map((s) => [s.provider, s.outcome])).toEqual([
      ["Provider A", "killed"],
      ["Provider P", "rejected"],
      ["Provider B", null],
    ]);
    expect(segments[0].points.at(-1)?.[0]).toBe(158);
    expect(segments[2].points.at(-1)?.[0]).toBe(400);
  });

  it("tells the run in the order it happened", () => {
    expect(ticker.map((e) => `${e.t} ${e.text}`)).toEqual([
      "00:13 Training starts on Provider A",
      "00:28 We pull the plug on Provider A",
      "00:29 Failure noticed at step 158",
      "01:09 Checkpoint at step 150 accepted by both verifiers",
      "01:33 Training resumes on Provider P",
      "02:03 Provider P's checkpoint fails the quality test, refused",
      "02:30 Training resumes on Provider B",
      "03:01 Checkpoint at step 200 accepted by both verifiers",
      "03:56 Checkpoint at step 400 accepted by both verifiers",
      "03:56 Final model accepted",
      "04:08 Escrow pays out on-chain",
    ]);
  });
});
