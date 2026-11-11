/**
 * A double-entry journal rebuilt only from the escrow's own events on the chain.
 *
 * Accounts:
 *   wallet:<addr>   money outside the escrow, in someone's wallet
 *   locked:<jobId>  a job's budget (or dispute bond) held by the escrow
 *   owed:<addr>     credited by the escrow but not withdrawn yet, so a liability of the escrow
 *
 * Every entry moves one amount from one account to another, so the books balance by construction.
 * Replaying the journal gives what the escrow should hold, and the page compares that with the
 * contract's own counters and its real USDC balance.
 */

export type Hex = `0x${string}`;

export interface LogRef {
  block: bigint;
  logIndex: number;
  tx: Hex;
}

export type EscrowEvent = LogRef &
  (
    | { kind: "created"; jobId: Hex; client: Hex; budget: bigint }
    | { kind: "activated"; jobId: Hex }
    | { kind: "anchor"; jobId: Hex; anchorKind: number; attempt: number }
    | { kind: "attested"; jobId: Hex; passed: boolean }
    | { kind: "disputed"; jobId: Hex; bond: bigint }
    | { kind: "resolved"; jobId: Hex; clientUpheld: boolean }
    | { kind: "settled"; jobId: Hex; paid: bigint; refunded: bigint }
    | { kind: "refunded"; jobId: Hex; amount: bigint }
    | { kind: "cancelled"; jobId: Hex }
    | { kind: "withdrawal"; account: Hex; amount: bigint }
  );

/** The final split the escrow stores for a job (from getJob), needed because JobSettled only carries totals. */
export interface JobSplit {
  client: Hex;
  budget: bigint;
  arbiter: Hex;
  payees: Hex[];
  amounts: bigint[];
  refund: bigint;
  state: number;
}

export interface JournalEntry extends LogRef {
  jobId: Hex | null;
  memo: string;
  debit: string; // The account that receives.
  credit: string; // The account that gives.
  amount: bigint;
}

export interface Book {
  entries: JournalEntry[];
  /** Account -> balance. Wallet accounts go negative as money leaves them into the escrow. */
  balances: Map<string, bigint>;
  locked: bigint;
  owed: bigint;
  owedBy: Map<Hex, bigint>;
  problems: string[];
}

const lower = (a: string) => a.toLowerCase() as Hex;
export const wallet = (a: string) => `wallet:${lower(a)}`;
export const owed = (a: string) => `owed:${lower(a)}`;
export const locked = (jobId: string) => `locked:${lower(jobId)}`;

export function sortEvents<T extends LogRef>(events: T[]): T[] {
  return [...events].sort((a, b) => (a.block === b.block ? a.logIndex - b.logIndex : a.block < b.block ? -1 : 1));
}

export function buildBook(events: EscrowEvent[], splits: Map<string, JobSplit>): Book {
  const entries: JournalEntry[] = [];
  const problems: string[] = [];
  const bonds = new Map<string, bigint>();
  const resolved = new Set<string>();
  const add = (e: LogRef, jobId: Hex | null, memo: string, credit: string, debit: string, amount: bigint) => {
    if (amount > BigInt(0)) entries.push({ block: e.block, logIndex: e.logIndex, tx: e.tx, jobId, memo, credit, debit, amount });
  };

  for (const e of sortEvents(events)) {
    switch (e.kind) {
      case "created":
        add(e, e.jobId, "Client locked the budget (createJob)", wallet(e.client), locked(e.jobId), e.budget);
        break;
      case "disputed": {
        const split = splits.get(lower(e.jobId));
        bonds.set(lower(e.jobId), e.bond);
        if (split) add(e, e.jobId, "Client posted a dispute bond", wallet(split.client), locked(e.jobId), e.bond);
        else problems.push(`No stored job for dispute ${e.jobId}`);
        break;
      }
      case "resolved": {
        const split = splits.get(lower(e.jobId));
        const bond = bonds.get(lower(e.jobId)) ?? BigInt(0);
        resolved.add(lower(e.jobId));
        if (split) add(e, e.jobId, e.clientUpheld ? "Bond returned to the client" : "Bond forfeited to the arbiter", locked(e.jobId), owed(e.clientUpheld ? split.client : split.arbiter), bond);
        break;
      }
      case "settled":
      case "refunded": {
        const split = splits.get(lower(e.jobId));
        if (!split) {
          problems.push(`No stored job for ${e.jobId}`);
          break;
        }
        // A dispute that timed out without an arbiter decision returns the bond to the client.
        const bond = bonds.get(lower(e.jobId));
        if (bond && !resolved.has(lower(e.jobId))) add(e, e.jobId, "Bond returned after the arbiter timeout", locked(e.jobId), owed(split.client), bond);
        if (e.kind === "settled") {
          const paid = split.amounts.reduce((s, a) => s + a, BigInt(0));
          if (paid !== e.paid) problems.push(`Job ${short(e.jobId)}: the event says ${e.paid} paid, the stored split says ${paid}`);
          if (split.refund !== e.refunded) problems.push(`Job ${short(e.jobId)}: the event says ${e.refunded} refunded, the stored split says ${split.refund}`);
          split.payees.forEach((payee, i) => add(e, e.jobId, "Provider paid for accepted work", locked(e.jobId), owed(payee), split.amounts[i]));
          add(e, e.jobId, "Unused budget refunded to the client", locked(e.jobId), owed(split.client), split.refund);
        } else {
          // JobRefunded comes from a failed verdict (amount = stored refund) or a timeout refund (the whole budget).
          add(e, e.jobId, "Client refunded", locked(e.jobId), owed(split.client), e.amount);
        }
        break;
      }
      case "cancelled": {
        const split = splits.get(lower(e.jobId));
        if (split) add(e, e.jobId, "Client cancelled before work started", locked(e.jobId), owed(split.client), split.budget);
        else problems.push(`No stored job for cancelled ${e.jobId}`);
        break;
      }
      case "withdrawal":
        add(e, null, "Withdrawn to the wallet", owed(e.account), wallet(e.account), e.amount);
        break;
      default:
        break; // activated, anchor and attested move no money.
    }
  }

  const balances = new Map<string, bigint>();
  for (const entry of entries) {
    balances.set(entry.credit, (balances.get(entry.credit) ?? BigInt(0)) - entry.amount);
    balances.set(entry.debit, (balances.get(entry.debit) ?? BigInt(0)) + entry.amount);
  }
  let lockedTotal = BigInt(0);
  let owedTotal = BigInt(0);
  const owedBy = new Map<Hex, bigint>();
  for (const [account, balance] of balances) {
    if (balance < BigInt(0) && !account.startsWith("wallet:")) problems.push(`${account} went below zero`);
    if (account.startsWith("locked:")) lockedTotal += balance;
    if (account.startsWith("owed:")) {
      owedTotal += balance;
      if (balance > BigInt(0)) owedBy.set(account.slice(5) as Hex, balance);
    }
  }
  return { entries, balances, locked: lockedTotal, owed: owedTotal, owedBy, problems };
}

export interface Reserves {
  held: bigint;
  liabilities: bigint;
  surplus: bigint;
  /** Basis points of liabilities covered by the held balance, capped at 10000 for display. */
  coverageBps: number;
  solvent: boolean;
}

/** Proof of reserves: what the escrow holds in USDC against what it has promised. */
export function reserves(held: bigint, totalLocked: bigint, totalWithdrawable: bigint): Reserves {
  const liabilities = totalLocked + totalWithdrawable;
  const coverageBps = liabilities === BigInt(0) ? 10000 : Number((held * BigInt(10000)) / liabilities);
  return { held, liabilities, surplus: held - liabilities, coverageBps: Math.min(coverageBps, 10000), solvent: held >= liabilities };
}

export interface Reconciliation {
  title: string;
  passed: boolean;
  detail: string;
}

/** Three sources that must agree: the replayed journal, the contract's counters, and per-wallet balances. */
export function reconcile(
  book: Book,
  counters: { totalLocked: bigint; totalWithdrawable: bigint; held: bigint },
  withdrawableOf: Map<Hex, bigint>,
): Reconciliation[] {
  const res = reserves(counters.held, counters.totalLocked, counters.totalWithdrawable);
  const walletMismatches = [...new Set([...book.owedBy.keys(), ...withdrawableOf.keys()])].filter(
    (a) => (book.owedBy.get(a) ?? BigInt(0)) !== (withdrawableOf.get(a) ?? BigInt(0)),
  );
  const debits = book.entries.reduce((s, e) => s + e.amount, BigInt(0));
  return [
    {
      title: "The escrow's USDC covers everything it owes",
      passed: res.solvent,
      detail: `Holds ${usdc(counters.held)} USDC against ${usdc(res.liabilities)} USDC locked or owed`,
    },
    {
      title: "Replayed events match the contract's locked total",
      passed: book.locked === counters.totalLocked,
      detail: `Journal ${usdc(book.locked)}, contract totalLocked() ${usdc(counters.totalLocked)}`,
    },
    {
      title: "Replayed events match the contract's owed total",
      passed: book.owed === counters.totalWithdrawable,
      detail: `Journal ${usdc(book.owed)}, contract totalWithdrawable() ${usdc(counters.totalWithdrawable)}`,
    },
    {
      title: "Every wallet's balance matches withdrawable() on-chain",
      passed: walletMismatches.length === 0,
      detail: walletMismatches.length ? `Differs for ${walletMismatches.map(short).join(", ")}` : `${withdrawableOf.size} wallets checked one by one`,
    },
    {
      title: "Every journal entry balances",
      passed: book.problems.length === 0,
      detail: book.problems.length ? book.problems.join("; ") : `${book.entries.length} entries, ${usdc(debits)} USDC moved in total, debits equal credits`,
    },
  ];
}

export function journalCsv(entries: (JournalEntry & { time?: string })[]): string {
  const rows = [["block", "time_utc", "tx", "job_id", "memo", "debit", "credit", "amount_usdc"]];
  for (const e of entries) rows.push([e.block.toString(), e.time ?? "", e.tx, e.jobId ?? "", e.memo, e.debit, e.credit, usdc(e.amount)]);
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
}

/** Micro-USDC (6 decimals) to a plain string, exact. */
export function usdc(micros: bigint): string {
  const neg = micros < BigInt(0);
  const abs = neg ? -micros : micros;
  const whole = abs / BigInt(1_000_000);
  const frac = (abs % BigInt(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export function short(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
