import { describe, expect, it } from "vitest";
import sample from "../../../replay/recordings/sample-demo.json";
import { emptyState, reduce, reduceAll } from "./reduce";
import type { AnyGpuEvent, Recording } from "./types";

const rec = sample as Recording;

describe("reduce", () => {
  it("drops duplicate and replayed seq numbers", () => {
    const ev = rec.events[0];
    const once = reduce(emptyState, ev);
    expect(reduce(once, ev)).toBe(once);
    expect(reduce(once, { ...ev, seq: ev.seq - 1 } as AnyGpuEvent)).toBe(once);
  });

  it("upserts checkpoints by id through their lifecycle", () => {
    const s = reduceAll(rec.events);
    const ids = s.checkpoints.map((c) => c.checkpoint_id);
    expect(new Set(ids).size).toBe(ids.length);
    const p = s.checkpoints.find((c) => c.provider_id === "P");
    expect(p?.state).toBe("REJECTED");
    expect(p?.reason).toMatch(/margin/);
  });

  it("upserts chain txs by hash, so pending → confirmed is one row", () => {
    const s = reduceAll(rec.events);
    expect(s.chain.every((t) => t.status === "confirmed")).toBe(true);
    expect(new Set(s.chain.map((t) => t.tx_hash)).size).toBe(s.chain.length);
  });
});

describe("sample recording tells the demo story", () => {
  const s = reduceAll(rec.events);

  it("is labelled as a sample, not a real recording", () => {
    expect(rec.provenance).toBe("sample");
  });

  it("ends settled, paying A and B and nothing to P", () => {
    expect(s.jobState).toBe("SETTLED");
    expect(s.settlement?.payees.map((p) => p.provider_id)).toEqual(["A", "B"]);
    expect(s.settlement?.zero_paid.map((p) => p.provider_id)).toEqual(["P"]);
  });

  it("settlement amounts sum to the budget", () => {
    const st = s.settlement!;
    const cents = (x: string) => Math.round(Number(x) * 100);
    const paid = st.payees.reduce((a, p) => a + cents(p.amount_usdc), 0);
    expect(paid + cents(st.refund_usdc)).toBe(cents(st.budget_usdc));
  });

  it("bumps the fencing token on each recovery", () => {
    expect(s.fencingToken).toBe(3);
  });

  it("rejects C and adapts B with the same logical batch", () => {
    const c = s.compile.find((d) => d.provider_id === "C");
    const b = s.compile.find((d) => d.provider_id === "B");
    expect(c?.verdict).toBe("rejected");
    expect(b?.verdict).toBe("accepted");
    expect(b!.to!.micro_batch * b!.to!.accum).toBe(b!.from!.micro_batch * b!.from!.accum);
  });

  it("is ordered: seq increases with time", () => {
    for (let i = 1; i < rec.events.length; i++) {
      expect(rec.events[i].seq).toBeGreaterThan(rec.events[i - 1].seq);
      expect(Date.parse(rec.events[i].ts)).toBeGreaterThanOrEqual(Date.parse(rec.events[i - 1].ts));
    }
  });
});
