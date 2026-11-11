import { describe, expect, it } from "vitest";
import { buildBook, journalCsv, owed, reconcile, reserves, usdc, wallet, type EscrowEvent, type Hex, type JobSplit } from "./ledger";

const J = "0x6e352e7341a6fcfa0602fec7a4c7604b23dc1819065623993160c9bd05a5de3f" as Hex;
const CLIENT = "0x1c4d04718d0fe1fcb23052ccee2fe5d2d8fc337f" as Hex;
const A = "0x00000000000000000000000000000000000000aa" as Hex;
const B = "0x00000000000000000000000000000000000000bb" as Hex;
const ARB = "0x00000000000000000000000000000000000000cc" as Hex;
const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const b = (n: number) => BigInt(n);

const split = (over: Partial<JobSplit> = {}): JobSplit => ({
  client: CLIENT, budget: b(150000), arbiter: ARB, payees: [A, B], amounts: [b(50000), b(70000)], refund: b(30000), state: 5, ...over,
});

const created: EscrowEvent = { kind: "created", jobId: J, client: CLIENT, budget: b(150000), block: b(10), logIndex: 0, tx: tx(1) };
const settled: EscrowEvent = { kind: "settled", jobId: J, paid: b(120000), refunded: b(30000), block: b(30), logIndex: 0, tx: tx(3) };

describe("on-chain journal", () => {
  it("rebuilds the real Base Sepolia job: 0.15 locked, 0.12 paid, 0.03 refunded, all still owed", () => {
    const attested: EscrowEvent = { kind: "attested", jobId: J, passed: true, block: b(20), logIndex: 0, tx: tx(2) };
    const book = buildBook([settled, created, attested], new Map([[J, split()]]));
    expect(book.problems).toEqual([]);
    expect(book.entries.map((e) => e.memo)).toEqual([
      "Client locked the budget (createJob)",
      "Provider paid for accepted work",
      "Provider paid for accepted work",
      "Unused budget refunded to the client",
    ]);
    expect(book.locked).toBe(b(0));
    expect(book.owed).toBe(b(150000));
    expect(book.balances.get(wallet(CLIENT))).toBe(b(-150000));
    expect(book.owedBy.get(A)).toBe(b(50000));
    expect(book.owedBy.get(CLIENT)).toBe(b(30000));
  });

  it("debits always equal credits across all accounts", () => {
    const w: EscrowEvent = { kind: "withdrawal", account: A, amount: b(50000), block: b(40), logIndex: 0, tx: tx(4) };
    const book = buildBook([created, settled, w], new Map([[J, split()]]));
    const sum = [...book.balances.values()].reduce((s, v) => s + v, b(0));
    expect(sum).toBe(b(0));
    expect(book.owedBy.has(A)).toBe(false);
    expect(book.balances.get(wallet(A))).toBe(b(50000));
  });

  it("flags an event total that disagrees with the stored split", () => {
    const book = buildBook([created, { ...settled, paid: b(110000) } as EscrowEvent], new Map([[J, split()]]));
    expect(book.problems.join()).toMatch(/110000 paid/);
  });

  it("a failed verdict refunds the client in full", () => {
    const refunded: EscrowEvent = { kind: "refunded", jobId: J, amount: b(150000), block: b(30), logIndex: 0, tx: tx(3) };
    const book = buildBook([created, refunded], new Map([[J, split({ payees: [], amounts: [], refund: b(150000), state: 6 })]]));
    expect(book.owedBy.get(CLIENT)).toBe(b(150000));
    expect(book.locked).toBe(b(0));
  });

  it("a dispute locks the bond, and a rejected dispute pays it to the arbiter", () => {
    const disputed: EscrowEvent = { kind: "disputed", jobId: J, bond: b(1000000), block: b(25), logIndex: 0, tx: tx(5) };
    const resolved: EscrowEvent = { kind: "resolved", jobId: J, clientUpheld: false, block: b(30), logIndex: 0, tx: tx(6) };
    const later = { ...settled, logIndex: 1 } as EscrowEvent;
    const book = buildBook([created, disputed, resolved, later], new Map([[J, split()]]));
    expect(book.problems).toEqual([]);
    expect(book.owedBy.get(ARB)).toBe(b(1000000));
    expect(book.balances.get(wallet(CLIENT))).toBe(b(-1150000));
    expect(book.locked).toBe(b(0));
  });

  it("an arbiter timeout returns the bond to the client", () => {
    const disputed: EscrowEvent = { kind: "disputed", jobId: J, bond: b(1000000), block: b(25), logIndex: 0, tx: tx(5) };
    const book = buildBook([created, disputed, settled], new Map([[J, split()]]));
    expect(book.owedBy.get(CLIENT)).toBe(b(1030000));
  });

  it("an unfinished job stays locked", () => {
    const book = buildBook([created], new Map([[J, split({ state: 2 })]]));
    expect(book.locked).toBe(b(150000));
    expect(book.owed).toBe(b(0));
  });
});

describe("reserves and reconciliation", () => {
  it("covers liabilities exactly", () => {
    expect(reserves(b(150000), b(0), b(150000))).toMatchObject({ solvent: true, coverageBps: 10000, surplus: b(0) });
    expect(reserves(b(100000), b(0), b(150000))).toMatchObject({ solvent: false, coverageBps: 6666 });
    expect(reserves(b(0), b(0), b(0)).solvent).toBe(true);
  });

  it("passes when the journal, the counters and each wallet agree", () => {
    const book = buildBook([created, settled], new Map([[J, split()]]));
    const checks = reconcile(book, { totalLocked: b(0), totalWithdrawable: b(150000), held: b(150000) }, new Map([[A, b(50000)], [B, b(70000)], [CLIENT, b(30000)]]));
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it("fails when one wallet's on-chain balance differs", () => {
    const book = buildBook([created, settled], new Map([[J, split()]]));
    const checks = reconcile(book, { totalLocked: b(0), totalWithdrawable: b(150000), held: b(150000) }, new Map([[A, b(1)], [B, b(70000)], [CLIENT, b(30000)]]));
    expect(checks.find((c) => c.title.startsWith("Every wallet"))?.passed).toBe(false);
  });
});

describe("formatting", () => {
  it("formats micro-USDC exactly", () => {
    expect(usdc(b(150000))).toBe("0.15");
    expect(usdc(b(1000000))).toBe("1");
    expect(usdc(b(-30000))).toBe("-0.03");
    expect(usdc(b(1))).toBe("0.000001");
  });

  it("writes a quoted CSV journal", () => {
    const book = buildBook([created], new Map([[J, split()]]));
    const csv = journalCsv(book.entries);
    expect(csv.split("\n")[0]).toBe("block,time_utc,tx,job_id,memo,debit,credit,amount_usdc");
    expect(csv).toContain(`locked:${J}`);
    expect(csv).toContain(owed(CLIENT).slice(0, 5) === "owed:" ? "0.15" : "");
  });
});
