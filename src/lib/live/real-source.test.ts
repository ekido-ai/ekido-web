import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealLiveSource } from "./real-source";

/** A socket that never opens, like one aimed at a job the coordinator no longer has. */
class DeadSocket {
  static opened: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    DeadSocket.opened.push(url);
  }
  close() {}
}

const provider = (id: string, name: string) => ({ provider_id: id, name, status: "online", gpu: {}, price_per_step_usdc: "0.001" });
const job = "11111111-2222-3333-4444-555555555555";
const selected = "22222222-2222-3333-4444-555555555555";
const event = { id: 1, job_id: job, type: "job.state_changed", ts: "2026-11-07T07:00:00Z", provenance: "SYNTHETIC", data: { from: "ASSIGNED", to: "RUNNING", reason: "" } };

describe("RealLiveSource after a coordinator restart", () => {
  let jobs: unknown[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", DeadSocket);
    jobs = [{ job_id: job }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        const body = path === "/providers" ? [provider("aaaa", "Provider A")] : path === "/jobs" ? jobs :
          path === `/jobs/${selected}` ? { job_id: selected } :
          path === `/jobs/${selected}/timeline` ? [{ ...event, job_id: selected }] :
          path.endsWith("/timeline") ? [event] : {};
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("drops the old job and reads as connected when the new coordinator has no jobs", async () => {
    const source = new RealLiveSource("http://127.0.0.1:8000");
    source.start();
    await vi.advanceTimersByTimeAsync(4500);
    // Following the job, but its socket never opened.
    expect(source.getSnapshot().connection).toBe("connecting");
    expect(source.getSnapshot().state.jobState).toBe("RUNNING");

    jobs = []; // restarted, empty database
    await vi.advanceTimersByTimeAsync(3500);
    expect(source.getSnapshot().connection).toBe("live");
    // Only the new provider list is left: no job, nothing from the old run.
    expect(source.getSnapshot().state.jobId).toBeNull();
    expect(source.getSnapshot().state.log.every((e) => e.type === "provider.updated")).toBe(true);
    source.stop();
  });

  it("keeps watching the selected job while the latest job is different", async () => {
    const source = new RealLiveSource("http://127.0.0.1:8000");
    source.start();
    await vi.advanceTimersByTimeAsync(4500);
    expect(source.getSnapshot().state.jobId).toBe(job);
    source.selectJob(selected);
    await vi.advanceTimersByTimeAsync(8000);
    expect(source.getSnapshot().state.jobId).toBe(selected);
    expect(DeadSocket.opened.at(-1)).toContain(selected);
    source.stop();
  });
});
