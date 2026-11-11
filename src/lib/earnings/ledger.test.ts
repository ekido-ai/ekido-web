import { describe, expect, it } from "vitest";
import { MAX_PAGES, PAGE_SIZE, csvCell, loadLedger, parsePage, receiptCsv, receiptJson, stageOf, totals, type SettlementRow } from "./ledger";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";

function row(i: number, over: Partial<SettlementRow> = {}): Record<string, unknown> {
  return {
    job_id: `job-${String(i).padStart(4, "0")}`,
    status: "SETTLED",
    finalize_tx: "0xf1",
    verdict: { passed: true, payees: [A, B], amounts: [3_000_000, 1_000_000], refund: 6_000_000 },
    ...over,
  };
}

/** A fake /settlements that pages by offset, like Piyush's default-50 route. */
function pagedServer(n: number, mode: "offset" | "ignores" | "cursor" = "offset") {
  const all = Array.from({ length: n }, (_, i) => row(i));
  const calls: string[] = [];
  const get = async (path: string) => {
    calls.push(path);
    const u = new URL(path, "http://x");
    const limit = Number(u.searchParams.get("limit") ?? 50);
    if (mode === "ignores") return { status: 200, body: all.slice(0, limit) };
    if (mode === "cursor") {
      const at = Number(u.searchParams.get("cursor")?.replace("c", "") ?? 0);
      const items = all.slice(at, at + limit);
      return { status: 200, body: { items, next_cursor: at + limit < n ? `c${at + limit}` : null } };
    }
    const offset = Number(u.searchParams.get("offset") ?? 0);
    return { status: 200, body: all.slice(offset, offset + limit) };
  };
  return { get, calls };
}

describe("loadLedger", () => {
  it("reads past the default 50 rows until a short page", async () => {
    const s = pagedServer(123);
    const l = await loadLedger(s.get);
    expect(l.rows).toHaveLength(123);
    expect(l.coverage).toMatchObject({ complete: true, pages: 3, route: "/settlements" });
  });

  it("follows a cursor when the server sends one", async () => {
    const s = pagedServer(120, "cursor");
    const l = await loadLedger(s.get);
    expect(l.rows).toHaveLength(120);
    expect(l.coverage.complete).toBe(true);
    expect(s.calls[1]).toContain("cursor=c50");
  });

  it("says the history is limited when the server ignores paging", async () => {
    const l = await loadLedger(pagedServer(200, "ignores").get);
    expect(l.rows).toHaveLength(PAGE_SIZE);
    expect(l.coverage.complete).toBe(false);
    expect(l.coverage.reason).toMatch(/doesn't page/);
  });

  it("stops at the page cap and says so", async () => {
    const l = await loadLedger(pagedServer(PAGE_SIZE * MAX_PAGES + 10).get);
    expect(l.rows).toHaveLength(PAGE_SIZE * MAX_PAGES);
    expect(l.coverage.complete).toBe(false);
  });

  it("falls back to /jobs when there is no /settlements route", async () => {
    const get = async (path: string) => {
      if (path.startsWith("/settlements")) return { status: 404, body: null };
      if (path.startsWith("/jobs?")) return { status: 200, body: [{ job_id: "j1", state: "SETTLED" }, { job_id: "j2", state: "RUNNING" }] };
      if (path === "/jobs/j1/settlement") return { status: 200, body: row(1, { job_id: undefined as unknown as string }) };
      return { status: 200, body: { status: "NOT_STARTED" } };
    };
    const l = await loadLedger(get);
    expect(l.rows.map((r) => r.job_id)).toEqual(["j1"]);
    expect(l.coverage).toMatchObject({ complete: true, route: "/jobs" });
  });

  it("an empty coordinator is complete and empty", async () => {
    const l = await loadLedger(pagedServer(0).get);
    expect(l.rows).toEqual([]);
    expect(l.coverage.complete).toBe(true);
  });
});

describe("totals", () => {
  const rows = parsePage([
    row(1), // reported
    row(2, { status: "ATTESTED", finalize_tx: null }), // proposed
    row(3, { job_state: "DISPUTED" }), // disputed, even though status says SETTLED
    row(4, { status: "SETTLED", finalize_tx: null }), // no finalize tx: still only proposed
    row(5, { verdict: null }),
  ]).rows;

  it("keeps proposed, coordinator-reported and disputed amounts apart", () => {
    const t = totals(rows);
    expect(t.reported).toBe(4_000_000);
    expect(t.proposed).toBe(8_000_000);
    expect(t.disputed).toBe(4_000_000);
    expect(t.noVerdict).toBe(1);
    expect(t.payees.find((p) => p.address === A)).toMatchObject({ reported: 3_000_000, proposed: 6_000_000, disputed: 3_000_000 });
  });

  it("a dispute outranks a SETTLED status", () => {
    expect(stageOf(rows[2])).toBe("disputed");
    expect(stageOf(rows[3])).toBe("proposed");
  });
});

describe("receipts", () => {
  const r = parsePage([row(7)]).rows[0];

  it("JSON says it is coordinator data, not verified on chain", () => {
    const j = JSON.parse(receiptJson(r, "2026-11-07T00:00:00Z"));
    expect(j).toMatchObject({ source: "coordinator", verified_on_chain: false, credited_on_chain: null, withdrawn_on_chain: null });
    expect(j.verdict.amounts).toEqual(["3000000", "1000000"]);
    expect(j.limitations.join(" ")).toMatch(/supplied by the coordinator/);
  });

  it("CSV has one line per payee plus the refund, and the limits as comments", () => {
    const lines = receiptCsv(r, "t").trim().split("\n");
    expect(lines.filter((l) => l.startsWith("#")).length).toBeGreaterThan(0);
    const data = lines.filter((l) => !l.startsWith("#"));
    expect(data).toHaveLength(4); // header + 2 payees + refund
    expect(data[3]).toContain("refund");
  });

  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("a,b")).toBe(`"a,b"`);
    expect(csvCell(12)).toBe("12");
  });
});
