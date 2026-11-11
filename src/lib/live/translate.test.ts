import { describe, expect, it } from "vitest";
import real from "../../../replay/recordings/real-run.json";
import { recoveries } from "../events/derive";
import { describeStage } from "../events/describe";
import { reduceAll } from "../events/reduce";
import { lossSegments } from "../events/derive";
import { compileAttempts, qualityRows, settlementView } from "../events/views";
import { providerLetters, recordingFromRealRun, translate, type RealRecording } from "./translate";

const run = real as unknown as RealRecording;
const end = reduceAll(recordingFromRealRun(run, "5").events);

describe("a recorded real run reaches every screen", () => {
  it("nothing is dropped, and the job ends settled", () => {
    expect(end.jobState).toBe("SETTLED");
    expect(end.progress.at(-1)?.step).toBe(400);
    expect(Object.keys(end.providers).sort()).toEqual(["A", "B", "C", "P"]);
  });

  it("the rejection tells the same story as the screen expects", () => {
    expect(end.failures.map((f) => [f.provider_id, f.cause])).toEqual([
      ["A", "RUNTIME_EXIT"],
      ["P", "QUALITY_REJECTED"],
    ]);
    expect(end.failures[1].injected).toBe(true);
    const rejected = end.checkpoints.filter((c) => c.state === "REJECTED");
    expect(new Set(rejected.map((c) => c.provider_id))).toEqual(new Set(["P"]));
  });

  it("each recovery is grouped, resumed, and names who took over", () => {
    const list = recoveries(end);
    expect(list.map((r) => [r.status, r.failedProviderId, r.replacementId])).toEqual([
      ["resumed", "A", "P"],
      ["resumed", "P", "B"],
    ]);
    expect(list[0].checkpointStep).toBe(150);
  });

  it("the loss chart has one line per worker, and only P's is marked rejected", () => {
    const segments = lossSegments(end);
    expect(segments.map((s) => [s.providerId, s.rejected])).toEqual([
      ["A", false],
      ["P", true],
      ["B", false],
    ]);
  });

  it("verifier votes become one row per checkpoint", () => {
    const rows = qualityRows(end);
    expect(new Set(rows.map((r) => r.checkpointId)).size).toBe(rows.length);
    expect(rows.every((r) => r.verifiers.length >= 2)).toBe(true);
  });

  it("the adapted replacement keeps the logical batch", () => {
    const b = compileAttempts(end).at(-1)!.rows.find((r) => r.providerId === "B")!;
    expect(b.verdict).toBe("accepted");
    expect(b.to!.micro_batch * b.to!.accum).toBe(32);
    expect(b.logicalBatchKept).toBe(true);
  });

  it("the payout matches what settled on-chain in the recorded run", () => {
    const view = settlementView(end)!;
    expect(view.payees.map((p) => [p.providerId, p.steps, p.micros])).toEqual([
      ["A", 150, 150_000],
      ["B", 250, 750_000],
    ]);
    expect(view.refundMicros).toBe(4_100_000);
    expect(view.balanced).toBe(true);
    expect(view.zeroPaid.map((z) => [z.providerId, z.rejectedSteps])).toEqual([["P", 50]]);
  });

  it("the headline names the provider in plain words", () => {
    expect(describeStage(end).headline).toBe("Paid for accepted work only");
  });
});

describe("who is training", () => {
  it("names the replacement as soon as it's assigned, not the worker that was killed", () => {
    const events = translate(run.events, run.providers);
    const assign = events.findIndex((e) => e.type === "recovery.step" && e.payload.stage === "ASSIGN");
    expect(reduceAll(events.slice(0, assign + 1)).activeProviderId).toBe("P");
  });
});

describe("delivery problems", () => {
  it("out-of-order events give exactly the same screen", () => {
    const shuffled = [...run.events].reverse();
    const a = reduceAll(translate(shuffled, run.providers, { localBudget: "5" }));
    expect(a.checkpoints).toEqual(end.checkpoints);
    expect(a.failures).toEqual(end.failures);
    expect(a.settlement).toEqual(end.settlement);
  });

  it("a replaced worker's late message doesn't look like new work", () => {
    const killedAt = run.events.findIndex((e) => e.type === "job.state_changed" && e.data.to === "RECOVERING");
    const a = run.providers.find((p) => p.name === "Provider A")!.provider_id;
    const late = { id: run.events[killedAt].id + 0.5, ts: run.events[killedAt].ts, type: "training.progress", job_id: run.events[killedAt].job_id, data: { provider_id: a, step: 158, total_steps: 400, loss: 0.1 } };
    const state = reduceAll(translate([...run.events, late], run.providers));
    expect(state.progress.filter((p) => p.provider_id === "A").at(-1)!.step).toBeLessThan(160);
    expect(lossSegments(state).length).toBe(3);
  });
});

describe("money stays exact", () => {
  it("a payout that doesn't fall on whole cents still balances", () => {
    const state = reduceAll(translate([{ id: 1, ts: "2026-11-05T00:00:00Z", type: "job.state_changed", job_id: "j", data: { from: "VALIDATING", to: "COMPLETED", reason: "" } }], run.providers, {
      preview: { steps: { "Provider A": 125, "Provider B (capped 768 MiB)": 275 }, payouts: { "Provider A": "0.125", "Provider B (capped 768 MiB)": "0.825" }, refund: "4.05", budget: "5" },
    }));
    const view = settlementView(state)!;
    expect(view.balanced).toBe(true);
    expect(view.payees.map((p) => p.micros)).toEqual([125_000, 825_000]);
  });
});

describe("providerLetters", () => {
  const provider = (provider_id: string, name: string) => ({ provider_id, name, kind: "REAL" as const, status: "ONLINE", capacity_mib: null, price_per_step: "0.001" });

  it("uses the letter in the name, and a free one otherwise", () => {
    const letters = providerLetters([provider("1", "Provider P (injected fault)"), provider("2", "Teammate laptop"), provider("3", "Provider A")]);
    expect(letters.get("1")).toBe("P");
    expect(letters.get("3")).toBe("A");
    expect(letters.get("2")).toBe("B");
  });
});
