import { describe, expect, it } from "vitest";
import sample from "../../../replay/recordings/sample-demo.json";
import { reduceAll } from "./reduce";
import { checkpointMarks, freshTelemetry, lossSegments, providerNotes, recoveries, recoveryFeed } from "./derive";
import type { Recording } from "./types";

const rec = sample as Recording;
const end = reduceAll(rec.events);

/** State just after the first event matching `pred`. */
function at(pred: (e: Recording["events"][number]) => boolean) {
  const i = rec.events.findIndex(pred);
  return reduceAll(rec.events.slice(0, i + 1));
}

describe("lossSegments", () => {
  it("makes one segment per attempt and flags only P's as rejected", () => {
    const segs = lossSegments(end);
    expect(segs.map((s) => s.providerId)).toEqual(["A", "P", "B"]);
    expect(segs.map((s) => s.rejected)).toEqual([false, true, false]);
  });

  it("marks the current segment live only while running", () => {
    const running = at((e) => e.type === "training.progress" && e.payload.provider_id === "B");
    expect(lossSegments(running).at(-1)?.live).toBe(true);
    expect(lossSegments(end).some((s) => s.live)).toBe(false);
  });

  it("puts every checkpoint on a segment", () => {
    const segs = lossSegments(end);
    expect(checkpointMarks(end, segs)).toHaveLength(end.checkpoints.length);
  });
});

describe("recoveryFeed", () => {
  it("is in time order and covers both recoveries", () => {
    const feed = recoveryFeed(end);
    const ts = feed.map((e) => Date.parse(e.ts));
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(feed.filter((e) => e.title === "Training resumed")).toHaveLength(2);
    expect(feed.some((e) => e.title === "Provider C can't run it")).toBe(true);
  });

  it("shows the latest step as in progress while recovering", () => {
    const mid = at((e) => e.type === "recovery.step" && e.payload.stage === "FENCED");
    expect(recoveryFeed(mid).at(-1)?.tone).toBe("active");
  });
});

describe("recoveries", () => {
  it("groups the two sample recoveries with their numbers", () => {
    const [kill, reject] = recoveries(end);
    expect(kill).toMatchObject({
      attempt: 2,
      status: "resumed",
      cause: "RUNTIME_EXIT",
      injected: true,
      failedProviderId: "A",
      checkpointStep: 100,
      lostSteps: 12,
      replacementId: "P",
    });
    expect(reject).toMatchObject({
      attempt: 3,
      status: "resumed",
      cause: "QUALITY_REJECTED",
      failedProviderId: "P",
      lostSteps: 50,
      replacementId: "B",
    });
  });

  it("phases add up to the time to resume", () => {
    for (const r of recoveries(end)) {
      const sum = r.phases.reduce((a, p) => a + (p.ms ?? 0), 0);
      expect(sum).toBe(r.elapsedMs);
    }
  });

  it("keeps only its own entries, and none are left spinning once resumed", () => {
    const [kill, reject] = recoveries(end);
    expect(kill.entries.some((e) => e.title.includes("Provider C"))).toBe(false);
    expect(reject.entries.some((e) => e.title === "Provider C can't run it")).toBe(true);
    expect([...kill.entries, ...reject.entries].some((e) => e.tone === "active")).toBe(false);
  });

  it("reports an unfinished recovery as in progress with open phases", () => {
    const mid = at((e) => e.type === "recovery.step" && e.payload.stage === "FENCED");
    const [r] = recoveries(mid);
    expect(r.status).toBe("in_progress");
    expect(r.phases[0].ms).not.toBeNull();
    expect(r.phases[3].ms).toBeNull();
    expect(r.replacementId).toBeNull();
  });
});

describe("providers", () => {
  it("drops telemetry from a provider that went quiet", () => {
    expect(freshTelemetry(end, "A")).toBeNull();
  });

  it("explains what happened to each provider", () => {
    expect(providerNotes(end, "P")[0].text).toMatch(/rejected/);
    expect(providerNotes(end, "C")[0].text).toMatch(/OOM/);
    expect(providerNotes(end, "B")[0].text).toMatch(/32 → 8/);
    expect(providerNotes(end, "A")[0].text).toMatch(/Stopped/);
  });
});
