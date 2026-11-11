import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sample from "../../../replay/recordings/sample-demo.json";
import type { Recording } from "../events/types";
import { LiveSource } from "./live-source";

const rec = sample as Recording;

class FakeWs {
  static all: FakeWs[] = [];
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeWs.all.push(this);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event("open"));
  }
  send(x: unknown) {
    this.onmessage?.({ data: JSON.stringify(x) } as MessageEvent);
  }
  drop() {
    this.onclose?.({} as CloseEvent);
  }
}

const last = () => FakeWs.all.at(-1)!;

describe("LiveSource", () => {
  beforeEach(() => {
    FakeWs.all = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const make = () => new LiveSource({ url: "ws://x/ws/jobs/current", WebSocketImpl: FakeWs, offlineAfter: 3 });

  it("connects, reads hello and events into state", () => {
    const s = make();
    s.start();
    expect(s.getSnapshot().connection).toBe("connecting");
    last().open();
    expect(s.getSnapshot().connection).toBe("live");
    last().send({ kind: "hello", server: "mock-coordinator", provenance: "sample" });
    rec.events.slice(0, 20).forEach((e) => last().send(e));
    expect(s.getSnapshot().hello?.provenance).toBe("sample");
    expect(s.getSnapshot().state.seq).toBe(19);
  });

  it("accepts a batch array and ignores junk frames", () => {
    const s = make();
    s.start();
    last().open();
    last().onmessage?.({ data: "not json" } as MessageEvent);
    last().send(rec.events.slice(0, 5));
    last().send({ hello: "?" });
    expect(s.getSnapshot().state.seq).toBe(4);
  });

  it("reconnects with backoff and asks only for what it hasn't seen", () => {
    const s = make();
    s.start();
    last().open();
    rec.events.slice(0, 10).forEach((e) => last().send(e));
    last().drop();
    expect(s.getSnapshot().connection).toBe("reconnecting");
    vi.advanceTimersByTime(500);
    expect(FakeWs.all).toHaveLength(2);
    expect(new URL(last().url).searchParams.get("after_seq")).toBe("9");
    last().open();
    // server resends an overlapping range: duplicates are dropped
    rec.events.slice(5, 15).forEach((e) => last().send(e));
    const st = s.getSnapshot().state;
    expect(st.seq).toBe(14);
    expect(st.log).toHaveLength(15);
  });

  it("reads offline after repeated failures but keeps retrying", () => {
    const s = make();
    s.start();
    for (let i = 0; i < 4; i++) {
      last().drop();
      vi.advanceTimersByTime(10_000);
    }
    expect(s.getSnapshot().connection).toBe("offline");
    expect(FakeWs.all.length).toBeGreaterThanOrEqual(4);
  });

  it("stop closes the socket and stays idle", () => {
    const s = make();
    s.start();
    last().open();
    const ws = last();
    s.stop();
    expect(ws.closed).toBe(true);
    expect(s.getSnapshot().connection).toBe("idle");
    vi.advanceTimersByTime(20_000);
    expect(FakeWs.all).toHaveLength(1);
  });
});
