import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countConnected, isConnected, watchProviders, type ProviderState } from "./providers";

describe("isConnected", () => {
  it("reads the coordinator's capital-letter statuses", () => {
    expect(isConnected("ONLINE")).toBe(true);
    expect(isConnected("BUSY")).toBe(true);
    expect(isConnected("OFFLINE")).toBe(false);
    expect(isConnected("SUSPECT")).toBe(false);
  });

  it("does not care about case, and treats a missing status as not connected", () => {
    expect(isConnected("online")).toBe(true);
    expect(isConnected("Offline")).toBe(false);
    expect(isConnected(undefined)).toBe(false);
    expect(isConnected(null)).toBe(false);
    expect(isConnected("")).toBe(false);
  });
});

describe("countConnected", () => {
  it("does not count an OFFLINE provider (the bug: it compared with lower-case 'offline')", () => {
    expect(countConnected([{ status: "ONLINE" }, { status: "OFFLINE" }, { status: "BUSY" }, { status: "SUSPECT" }])).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(countConnected([])).toBe(0);
  });
});

describe("watchProviders", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const reply = (rows: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => rows }));

  it("reads at once, then again every interval, so a change shows without reloading", async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce({ ok: true, json: async () => [{ status: "ONLINE" }, { status: "ONLINE" }] });
    fetchImpl.mockResolvedValue({ ok: true, json: async () => [{ status: "ONLINE" }, { status: "OFFLINE" }] });
    const seen: ProviderState<{ status: string }>[] = [];
    const stop = watchProviders("https://c.example", (s) => seen.push(s), { intervalMs: 10_000, fetchImpl, isHidden: () => false });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    stop();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://c.example/providers");
    expect(seen).toHaveLength(2);
    expect(countConnected(seen[0] as { status: string }[])).toBe(2);
    expect(countConnected(seen[1] as { status: string }[])).toBe(1);
  });

  it("reports down when the coordinator fails, and recovers on the next good answer", async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    fetchImpl.mockResolvedValue({ ok: true, json: async () => [{ status: "ONLINE" }] });
    const seen: ProviderState<{ status: string }>[] = [];
    const stop = watchProviders("https://c.example", (s) => seen.push(s), { intervalMs: 5_000, fetchImpl, isHidden: () => false });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5_000);
    stop();
    expect(seen[0]).toBe("down");
    expect(seen[1]).toEqual([{ status: "ONLINE" }]);
  });

  it("treats a network error or a body that is not a list as down", async () => {
    const seen: ProviderState<{ status: string }>[] = [];
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const stopFailing = watchProviders("https://c.example", (s) => seen.push(s), { intervalMs: 5_000, fetchImpl: failing, isHidden: () => false });
    await vi.advanceTimersByTimeAsync(0);
    stopFailing();
    const notList = reply({ error: "x" });
    const stopNotList = watchProviders("https://c.example", (s) => seen.push(s), { intervalMs: 5_000, fetchImpl: notList, isHidden: () => false });
    await vi.advanceTimersByTimeAsync(0);
    stopNotList();
    expect(seen).toEqual(["down", "down"]);
  });

  it("does not read while the tab is hidden", async () => {
    const fetchImpl = reply([{ status: "ONLINE" }]);
    const stop = watchProviders("https://c.example", () => {}, { intervalMs: 5_000, fetchImpl, isHidden: () => true });
    await vi.advanceTimersByTimeAsync(20_000);
    stop();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stops polling and stops calling back after stop()", async () => {
    const fetchImpl = reply([{ status: "ONLINE" }]);
    const onChange = vi.fn();
    const stop = watchProviders("https://c.example", onChange, { intervalMs: 5_000, fetchImpl, isHidden: () => false });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    const calls = fetchImpl.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchImpl.mock.calls.length).toBe(calls);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("never starts a second request while one is still waiting", async () => {
    let release: (v: { ok: boolean; json(): Promise<unknown> }) => void = () => {};
    const fetchImpl = vi.fn(() => new Promise<{ ok: boolean; json(): Promise<unknown> }>((resolve) => (release = resolve)));
    const stop = watchProviders("https://c.example", () => {}, { intervalMs: 1_000, fetchImpl, isHidden: () => false });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    release({ ok: true, json: async () => [] });
    await vi.advanceTimersByTimeAsync(1_000);
    stop();
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});


import { connectedCapacityMib, formatCapacity, sortRoster, statusLabel } from "./providers";

describe("roster helpers", () => {
  it("labels every state in words", () => {
    expect(statusLabel("ONLINE")).toBe("Connected");
    expect(statusLabel("BUSY")).toBe("Connected, working");
    expect(statusLabel("SUSPECT")).toBe("Not responding");
    expect(statusLabel("OFFLINE")).toBe("Disconnected");
    expect(statusLabel(undefined)).toBe("Disconnected");
    expect(statusLabel("something new")).toBe("Disconnected");
  });

  it("formats capacity and shows a dash when it is missing or nonsense", () => {
    expect(formatCapacity(4096)).toBe("4 GiB");
    expect(formatCapacity(6144)).toBe("6 GiB");
    expect(formatCapacity(1536)).toBe("1.5 GiB");
    expect(formatCapacity(512)).toBe("512 MiB");
    expect(formatCapacity(null)).toBe("–");
    expect(formatCapacity(undefined)).toBe("–");
    expect(formatCapacity(0)).toBe("–");
    expect(formatCapacity(-5)).toBe("–");
    expect(formatCapacity(Number.NaN)).toBe("–");
  });

  it("adds up the memory of connected providers only", () => {
    expect(
      connectedCapacityMib([
        { status: "ONLINE", capacity_mib: 4096 },
        { status: "BUSY", capacity_mib: 2048 },
        { status: "OFFLINE", capacity_mib: 8192 },
        { status: "SUSPECT", capacity_mib: 1024 },
        { status: "ONLINE", capacity_mib: null },
      ]),
    ).toBe(6144);
    expect(connectedCapacityMib([])).toBe(0);
  });

  it("puts connected providers first, then sorts by name, without changing the input", () => {
    const rows = [
      { status: "OFFLINE", name: "A" },
      { status: "ONLINE", name: "Z" },
      { status: "BUSY", name: "B" },
      { status: "SUSPECT", name: "C" },
    ];
    expect(sortRoster(rows).map((r) => r.name)).toEqual(["B", "Z", "A", "C"]);
    expect(rows.map((r) => r.name)).toEqual(["A", "Z", "B", "C"]);
  });
});
