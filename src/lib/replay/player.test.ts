import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sample from "../../../replay/recordings/sample-demo.json";
import { reduceAll } from "../events/reduce";
import type { Recording } from "../events/types";
import { ReplayPlayer } from "./player";

const rec = sample as Recording;

describe("ReplayPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays to the end and matches reducing everything at once", () => {
    const p = new ReplayPlayer(rec);
    p.play();
    vi.advanceTimersByTime(p.durationMs + 1000);
    const snap = p.getSnapshot();
    expect(snap.playing).toBe(false);
    expect(snap.index).toBe(rec.events.length);
    expect(snap.state.seq).toBe(reduceAll(rec.events).seq);
    expect(snap.state.jobState).toBe("SETTLED");
  });

  it("speed scales wall time", () => {
    const p = new ReplayPlayer(rec);
    p.setSpeed(4);
    p.play();
    vi.advanceTimersByTime(p.durationMs / 4 + 50);
    expect(p.getSnapshot().index).toBe(rec.events.length);
  });

  it("seeking backwards rebuilds state exactly", () => {
    const p = new ReplayPlayer(rec);
    p.seek(p.durationMs);
    expect(p.getSnapshot().state.jobState).toBe("SETTLED");
    p.seek(0);
    const s = p.getSnapshot().state;
    expect(s.progress).toHaveLength(0);
    expect(s.settlement).toBeNull();
  });

  it("keeps the snapshot reference stable until something changes", () => {
    const p = new ReplayPlayer(rec);
    const a = p.getSnapshot();
    expect(p.getSnapshot()).toBe(a);
    p.stepForward();
    expect(p.getSnapshot()).not.toBe(a);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const p = new ReplayPlayer(rec);
    const fn = vi.fn();
    const off = p.subscribe(fn);
    p.stepForward();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    p.stepForward();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
