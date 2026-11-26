// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderEn } from "@/components/platform/test-intl";
import type { PreparedSignedRequest } from "@/lib/jobs/signed-request";

// No chain reads in a unit test: the escrow is not funded yet, and there is no browser wallet.
vi.mock("@/lib/wallet/escrow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wallet/escrow")>()),
  inspectFundedEscrow: () => Promise.resolve(null),
  injectedProvider: () => null,
}));

const { FundStep } = await import("./fund-step");

afterEach(cleanup);

const prepared = {
  body: { job_id: "job-1", budget_usdc: "5", deadline_seconds: 3600, client_address: "0x00000000000000000000000000000000000000c1" },
  specHash: "0x" + "a".repeat(64),
  policyHash: "0x" + "b".repeat(64),
  onchainId: "0x" + "c".repeat(64),
} as unknown as PreparedSignedRequest;

describe("FundStep", () => {
  it("names the four steps in order, with the budget on the approval step", async () => {
    renderEn(<FundStep prepared={prepared} onFunded={vi.fn()} />);
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(steps[0]).toContain("1. Connect wallet");
    expect(steps[1]).toMatch(/^2\. Switch to /);
    expect(steps[2]).toContain("3. Allow the escrow to take exactly the budget (5 USDC)");
    expect(steps[3]).toContain("4. Lock the budget in escrow");
  });

  it("says what blocks the current step instead of showing a dead button", async () => {
    renderEn(<FundStep prepared={prepared} onFunded={vi.fn()} />);
    expect(await screen.findByText("No browser wallet found. Install a wallet extension to fund the job.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the terms with plain seconds and no raw message keys", () => {
    renderEn(<FundStep prepared={prepared} onFunded={vi.fn()} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("5 test USDC");
    expect(text).toContain("3600 s");
    expect(text).not.toMatch(/newJob\.|fund\.|steps\./);
  });
});
