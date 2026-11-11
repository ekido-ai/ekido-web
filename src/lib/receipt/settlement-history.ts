import type { SettlementRecord } from "./ledger";

/** Read every coordinator page without displaying partial results on failure. */
export async function fetchSettlementHistory(get: (path: string) => Promise<SettlementRecord[]>): Promise<SettlementRecord[]> {
  const all: SettlementRecord[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const page: SettlementRecord[] = await get(`/settlements?limit=200${cursor ? `&before_job_id=${encodeURIComponent(cursor)}` : ""}`);
    for (const row of page) {
      if (!row.job_id || seen.has(row.job_id)) throw new Error("The coordinator returned duplicate or invalid settlement records.");
      seen.add(row.job_id);
      all.push(row);
    }
    if (page.length < 200) return all;
    cursor = page[page.length - 1].job_id;
  }
}
