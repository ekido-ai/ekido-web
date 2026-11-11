import { describe, expect, it } from "vitest";
import realRun from "../../../replay/recordings/real-run-2026-11-04.json";
import { recordingFromRealRun, type RealRecording } from "../live/translate";
import { journey } from "./journey";
import { emptyState, reduceAll } from "./reduce";

const events = recordingFromRealRun(realRun as unknown as RealRecording, "5").events;
const t0 = Date.parse(events[0].ts);
const upTo = (seconds: number) => reduceAll(events.filter((e) => Date.parse(e.ts) - t0 <= seconds * 1000));
const statuses = (seconds: number) => journey(upTo(seconds)).map((s) => s.status);

describe("run journey on the real 4 Nov run", () => {
  it("has nothing done before the job exists", () => {
    expect(journey(emptyState).map((s) => s.status)).toEqual(["waiting", "waiting", "waiting", "waiting", "waiting", "waiting"]);
  });

  it("is training before the kill, recovering right after it", () => {
    expect(statuses(20)).toEqual(["active", "waiting", "waiting", "waiting", "waiting", "waiting"]);
    expect(statuses(35)).toEqual(["done", "done", "active", "waiting", "waiting", "waiting"]);
  });

  it("marks the refusal after the resume, and everything done at the end", () => {
    expect(statuses(130).slice(0, 4)).toEqual(["done", "done", "done", "done"]);
    const end = journey(reduceAll(events));
    expect(end.map((s) => s.status)).toEqual(["done", "done", "done", "done", "done", "done"]);
  });

  it("names who and when, from the events", () => {
    const end = journey(reduceAll(events));
    expect(end[1].detail).toBe("Provider A");
    expect(Math.round(end[1].atMs! / 1000)).toBe(29);
    expect(end[3].detail).toBe("Provider P, not paid");
    expect(Math.round(end[5].atMs! / 1000)).toBe(248);
  });
});

describe("plain words on screen", () => {
  it("never shows a raw provider id in a job state reason", () => {
    const reasons = events.filter((e) => e.type === "job.state_changed").map((e) => (e.payload as { reason: string }).reason);
    expect(reasons.some((r) => r.includes("Provider A"))).toBe(true);
    for (const r of reasons) expect(r).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
