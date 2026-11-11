import { describe, expect, it, vi } from "vitest";
import { fetchSettlementHistory } from "./settlement-history";

describe("settlement history", () => {
  const row = (job_id: string) => ({ job_id, status: "SETTLED", verdict: null });

  it("fetches later pages using the last job as a cursor", async () => {
    const first = Array.from({ length: 200 }, (_, i) => row(`job-${i}`));
    const get = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce([row("last")]);
    const rows = await fetchSettlementHistory(get);
    expect(rows).toHaveLength(201);
    expect(get).toHaveBeenNthCalledWith(2, "/settlements?limit=200&before_job_id=job-199");
  });

  it("rejects duplicate pages instead of returning an incorrect total", async () => {
    const first = Array.from({ length: 200 }, (_, i) => row(`job-${i}`));
    const get = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce([row("job-199")]);
    await expect(fetchSettlementHistory(get)).rejects.toThrow("duplicate");
  });
});
