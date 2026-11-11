/**
 * Earnings ledger: what the coordinator says each settlement is, kept apart from what is proven.
 *
 * Everything here comes from the coordinator's own database (its stored copy of the signed verdict
 * and its settlement status). None of it is read from the chain. So:
 *   - "proposed"  = a verdict exists that verifiers signed or are signing. Not money moved.
 *   - "reported"  = the coordinator recorded a finalize tx (status SETTLED). Still its own claim.
 *   - "credited"  = the escrow's final on-chain split. NOT AVAILABLE: needs a chain read.
 *   - "withdrawn" = provider withdraw() events. NOT AVAILABLE: needs a chain read.
 * A dispute can change the final split, and the coordinator's status can go stale when a case is
 * resolved outside it, so neither proposed nor reported amounts may be called paid or verified.
 */

export const PAGE_SIZE = 50;
/** Hard stop, so a server that ignores paging can't make the browser loop. 40 × 50 = 2000 rows. */
export const MAX_PAGES = 40;

export type Stage = "proposed" | "reported" | "disputed" | "refund_only" | "error";

export interface Verdict {
  jobId?: string;
  passed?: boolean;
  payees: string[];
  amounts: number[];
  refund: number;
  finalCheckpoint?: string;
  lineageRoot?: string;
  qualityReport?: string;
  expiry?: number;
}

export interface SettlementRow {
  job_id: string;
  /** Coordinator settlement status: AWAITING_SIGNATURES, SIGNED_NO_CHAIN, ATTESTED, SETTLED, ERROR, NOT_STARTED. */
  status: string;
  job_state: string | null;
  verdict: Verdict | null;
  submit_tx: string | null;
  finalize_tx: string | null;
  created_at: string | null;
}

export interface Coverage {
  /** True only when the server told us there is nothing more, by a short page or an empty cursor. */
  complete: boolean;
  /** Plain words for the screen when complete is false. */
  reason: string | null;
  pages: number;
  /** Which coordinator route the rows came from. */
  route: "/settlements" | "/jobs";
}

export interface Ledger {
  rows: SettlementRow[];
  coverage: Coverage;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const units = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export function parseVerdict(raw: unknown): Verdict | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const payees = Array.isArray(v.payees) ? v.payees.map(String) : [];
  const amounts = Array.isArray(v.amounts) ? v.amounts.map(units) : [];
  if (payees.length !== amounts.length) return null;
  return {
    jobId: str(v.jobId) ?? undefined,
    passed: typeof v.passed === "boolean" ? v.passed : undefined,
    payees,
    amounts,
    refund: units(v.refund),
    finalCheckpoint: str(v.finalCheckpoint) ?? undefined,
    lineageRoot: str(v.lineageRoot) ?? undefined,
    qualityReport: str(v.qualityReport) ?? undefined,
    expiry: typeof v.expiry === "number" ? v.expiry : undefined,
  };
}

export function parseRow(raw: unknown): SettlementRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const job_id = str(r.job_id);
  if (!job_id) return null;
  return {
    job_id,
    status: str(r.status) ?? "UNKNOWN",
    job_state: str(r.job_state) ?? str(r.state),
    verdict: parseVerdict(r.verdict),
    submit_tx: str(r.submit_tx),
    finalize_tx: str(r.finalize_tx),
    created_at: str(r.created_at),
  };
}

/** Accepts a bare array or {items|settlements, next_cursor|next_offset|has_more|total}. */
export function parsePage(body: unknown): { rows: SettlementRow[]; next: string | null; hasMore: boolean | null; total: number | null } {
  const obj = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const list = Array.isArray(body) ? body : Array.isArray(obj?.items) ? obj.items : Array.isArray(obj?.settlements) ? obj.settlements : [];
  const rows = (list as unknown[]).map(parseRow).filter((r): r is SettlementRow => r !== null);
  const nextRaw = obj?.next_cursor ?? obj?.next_offset ?? obj?.next ?? null;
  const next = nextRaw === null || nextRaw === undefined || nextRaw === "" ? null : String(nextRaw);
  const hasMore = typeof obj?.has_more === "boolean" ? obj.has_more : null;
  const total = typeof obj?.total === "number" ? obj.total : null;
  return { rows, next, hasMore, total };
}

export function stageOf(row: SettlementRow): Stage {
  if (row.job_state === "DISPUTED") return "disputed";
  if (row.status === "ERROR") return "error";
  if (row.verdict && row.verdict.passed === false) return "refund_only";
  if (row.status === "SETTLED" && row.finalize_tx) return "reported";
  return "proposed";
}

export const stageText: Record<Stage, string> = {
  proposed: "Proposed: verdict exists, nothing finalized yet",
  reported: "Coordinator reports finalized. Not checked on-chain",
  disputed: "Disputed. Final split may differ from this verdict",
  refund_only: "Failed job. Verdict refunds the client",
  error: "Settlement hit an error. Status may be stale",
};

export interface PayeeTotals {
  address: string;
  /** Base units in verdicts that have not been reported finalized (excludes disputed). */
  proposed: number;
  /** Base units in verdicts the coordinator reports finalized. Its claim, not a chain read. */
  reported: number;
  /** Base units in disputed verdicts: excluded from both of the above. */
  disputed: number;
  jobs: number;
}

export interface Totals {
  proposed: number;
  reported: number;
  disputed: number;
  refund: number;
  payees: PayeeTotals[];
  byStage: Record<Stage, number>;
  /** Rows with no readable verdict, so no amounts. */
  noVerdict: number;
}

export function totals(rows: readonly SettlementRow[]): Totals {
  const byPayee = new Map<string, PayeeTotals>();
  const byStage: Record<Stage, number> = { proposed: 0, reported: 0, disputed: 0, refund_only: 0, error: 0 };
  let proposed = 0, reported = 0, disputed = 0, refund = 0, noVerdict = 0;
  for (const row of rows) {
    const stage = stageOf(row);
    byStage[stage] += 1;
    if (!row.verdict) {
      noVerdict += 1;
      continue;
    }
    refund += row.verdict.refund;
    row.verdict.payees.forEach((address, i) => {
      const key = address.toLowerCase();
      const p = byPayee.get(key) ?? { address, proposed: 0, reported: 0, disputed: 0, jobs: 0 };
      const amount = row.verdict!.amounts[i];
      if (stage === "reported") {
        p.reported += amount;
        reported += amount;
      } else if (stage === "disputed") {
        p.disputed += amount;
        disputed += amount;
      } else {
        p.proposed += amount;
        proposed += amount;
      }
      p.jobs += 1;
      byPayee.set(key, p);
    });
  }
  const payees = [...byPayee.values()].sort((a, b) => b.reported + b.proposed - (a.reported + a.proposed));
  return { proposed, reported, disputed, refund, payees, byStage, noVerdict };
}

type Fetcher = (path: string) => Promise<{ status: number; body: unknown }>;

/**
 * Reads every settlement, page by page. Uses the coordinator's /settlements when it has one and
 * falls back to /jobs plus /jobs/{id}/settlement when it doesn't. Never claims "all" unless the
 * server said so.
 */
export async function loadLedger(get: Fetcher): Promise<Ledger> {
  const first = await get(`/settlements?limit=${PAGE_SIZE}&offset=0`);
  if (first.status === 404) return loadViaJobs(get);
  if (first.status >= 400) throw new Error(`HTTP ${first.status} from /settlements`);

  const rows: SettlementRow[] = [];
  const seen = new Set<string>();
  let page = parsePage(first.body);
  let pages = 1;
  let offset = 0;
  for (;;) {
    let fresh = 0;
    for (const r of page.rows) {
      if (seen.has(r.job_id)) continue;
      seen.add(r.job_id);
      rows.push(r);
      fresh += 1;
    }
    const total = page.total;
    const done =
      page.hasMore === false ||
      (total !== null && rows.length >= total) ||
      (page.hasMore === null && page.next === null && page.rows.length < PAGE_SIZE);
    if (done) return { rows, coverage: { complete: true, reason: null, pages, route: "/settlements" } };
    if (page.rows.length > 0 && fresh === 0) {
      return {
        rows,
        coverage: { complete: false, reason: `The coordinator sent the same ${rows.length} rows again, so it doesn't page. Older settlements may be missing.`, pages, route: "/settlements" },
      };
    }
    if (pages >= MAX_PAGES) {
      return { rows, coverage: { complete: false, reason: `Stopped after ${rows.length} rows (${MAX_PAGES} pages). Older settlements are not shown.`, pages, route: "/settlements" } };
    }
    offset += page.rows.length;
    const path = page.next !== null && !/^\d+$/.test(page.next)
      ? `/settlements?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(page.next)}`
      : `/settlements?limit=${PAGE_SIZE}&offset=${page.next ?? offset}`;
    const res = await get(path);
    if (res.status >= 400) {
      return { rows, coverage: { complete: false, reason: `Page ${pages + 1} failed (HTTP ${res.status}). Showing the first ${rows.length}.`, pages, route: "/settlements" } };
    }
    page = parsePage(res.body);
    pages += 1;
  }
}

/** The 5 Nov coordinator has no /settlements, and its /jobs caps at 100 with no paging. */
async function loadViaJobs(get: Fetcher): Promise<Ledger> {
  const JOBS_CAP = 100;
  const jobs = await get(`/jobs?limit=${JOBS_CAP}`);
  if (jobs.status >= 400) throw new Error(`HTTP ${jobs.status} from /jobs`);
  const list = (Array.isArray(jobs.body) ? jobs.body : []) as { job_id?: string; state?: string; created_at?: string }[];
  const rows: SettlementRow[] = [];
  for (const j of list) {
    if (!j.job_id) continue;
    const s = await get(`/jobs/${encodeURIComponent(j.job_id)}/settlement`);
    if (s.status >= 400) continue;
    const row = parseRow({ ...(s.body as object), job_id: j.job_id, job_state: j.state, created_at: j.created_at });
    if (row && row.status !== "NOT_STARTED") rows.push(row);
  }
  const complete = list.length < JOBS_CAP;
  return {
    rows,
    coverage: {
      complete,
      reason: complete ? null : `The coordinator lists at most ${JOBS_CAP} jobs and can't page, so only settlements from the newest ${JOBS_CAP} jobs are shown.`,
      pages: 1,
      route: "/jobs",
    },
  };
}

/* ------------------------------------------------------------------ receipts */

export const RECEIPT_LIMITS = [
  "Every field below was supplied by the coordinator. This dashboard did not read it from the chain.",
  "Amounts are the coordinator's stored copy of the signed verdict: proposed amounts, not proof of payment.",
  "A dispute can change the final split. The coordinator's status can be stale if a case was resolved outside it.",
  "Credited: the escrow's getJob() holds the final split after any dispute. Withdrawn: Withdrawal events are per wallet, not per job, so no receipt can say this job's money was withdrawn.",
];

export function receiptJson(row: SettlementRow, generatedAt: string): string {
  return JSON.stringify(
    {
      kind: "gpuchain.settlement-receipt.v0",
      generated_at: generatedAt,
      source: "coordinator",
      verified_on_chain: false,
      job_id: row.job_id,
      job_state: row.job_state,
      coordinator_status: row.status,
      stage: stageOf(row),
      stage_text: stageText[stageOf(row)],
      submit_tx: row.submit_tx,
      finalize_tx: row.finalize_tx,
      verdict: row.verdict
        ? { ...row.verdict, amounts: row.verdict.amounts.map(String), refund: String(row.verdict.refund) }
        : null,
      amount_units: "USDC base units (6 decimals)",
      credited_on_chain: null,
      withdrawn_on_chain: null,
      limitations: RECEIPT_LIMITS,
    },
    null,
    2,
  );
}

/** Quotes when needed, and defuses cells a spreadsheet would run as a formula. */
export const csvCell = (v: string | number | null) => {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function receiptCsv(row: SettlementRow, generatedAt: string): string {
  const head = ["job_id", "coordinator_status", "stage", "line", "address", "amount_base_units", "source", "verified_on_chain", "submit_tx", "finalize_tx", "generated_at"];
  const base = [row.job_id, row.status, stageOf(row)];
  const tail = ["coordinator", "false", row.submit_tx, row.finalize_tx, generatedAt];
  const lines: (string | number | null)[][] = [];
  row.verdict?.payees.forEach((address, i) => lines.push([...base, "payee", address, row.verdict!.amounts[i], ...tail]));
  lines.push([...base, "refund", "client", row.verdict ? row.verdict.refund : null, ...tail]);
  const notes = RECEIPT_LIMITS.map((l) => `# ${l}`);
  return [...notes, head.join(","), ...lines.map((l) => l.map(csvCell).join(","))].join("\n") + "\n";
}
