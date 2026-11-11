"use client";

import { useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import { config } from "@/lib/config";
import type { PreparedSignedRequest } from "@/lib/jobs/signed-request";
import {
  approveIfNeeded,
  chain,
  connect,
  createJobTx,
  ensureChain,
  explorerTx,
  friendlyError,
  injectedProvider,
  inspectFunding,
  waitForTx,
} from "@/lib/wallet/escrow";
import { Button } from "@/components/ui/button";
import { StatusIcon, type Tone } from "@/components/ui/status";
import { TxStatus } from "@/components/ui/states";
import { TruthBadge } from "@/components/ui/truth-badge";
import { cx } from "@/components/ui/cx";

type StepKey = "connect" | "network" | "approve" | "create";
type StepState = { status: "todo" | "busy" | "done" | "error" | "blocked"; note?: string; tx?: { hash: string; status: "pending" | "confirmed" | "failed" } };

const titles: Record<StepKey, string> = {
  connect: "Connect wallet",
  network: `Switch to ${chain.name}`,
  approve: "Allow the escrow to take exactly the budget",
  create: "Lock the budget in escrow",
};

const toneOf: Record<StepState["status"], Tone> = { todo: "idle", busy: "active", done: "good", error: "critical", blocked: "warning" };

/** Step 2: fund the escrow from the client's own wallet. Every signature happens in the wallet. */
export function FundStep({ prepared, onFunded }: { prepared: PreparedSignedRequest; onFunded: () => void }) {
  const [eth, setEth] = useState<EIP1193Provider | null>(null);
  const [checked, setChecked] = useState(false);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    connect: { status: "todo" },
    network: { status: "todo" },
    approve: { status: "todo" },
    create: { status: "todo" },
  });
  const escrow = config.escrowAddress;
  const budget = prepared.body.budget_usdc;

  useEffect(() => {
    // Wallet extensions inject after load; check once on the client.
    setEth(injectedProvider());
    setChecked(true);
  }, []);

  const patch = (k: StepKey, s: StepState) => setSteps((all) => ({ ...all, [k]: s }));

  async function run(k: StepKey, fn: () => Promise<StepState | void>) {
    const previousTx = steps[k].tx;
    patch(k, { status: "busy", tx: previousTx });
    try {
      const out = await fn();
      patch(k, out ?? { status: "done" });
    } catch (e) {
      setSteps((all) => ({ ...all, [k]: { ...all[k], status: "error", note: friendlyError(e) } }));
    }
  }

  const actions: Record<StepKey, () => void> = {
    connect: () =>
      run("connect", async () => {
        const a = await connect(eth!);
        if (a.toLowerCase() !== prepared.body.client_address.toLowerCase()) {
          throw new Error("Select the wallet that signed this job and try again.");
        }
        setAccount(a);
        return { status: "done", note: `${a.slice(0, 6)}…${a.slice(-4)}` };
      }),
    network: () => run("network", async () => {
      await ensureChain(eth!);
      if ((await inspectFunding(eth!, prepared)).funded) {
        patch("approve", { status: "done" });
        patch("create", { status: "done", note: "Existing escrow verified" });
        onFunded();
      }
    }),
    approve: () =>
      run("approve", async () => {
        const current = await inspectFunding(eth!, prepared);
        if (current.funded) {
          patch("create", { status: "done", note: "Existing escrow verified" });
          onFunded();
          return;
        }
        const pending = steps.approve.tx;
        const hash = pending?.status === "pending" ? pending.hash as `0x${string}` :
          await approveIfNeeded(eth!, current.account, current.escrow, current.amount);
        if (!hash) return { status: "done", note: "Allowance already covers the budget" };
        patch("approve", { status: "busy", tx: { hash, status: "pending" } });
        const r = await waitForTx(hash);
        if (r !== "success") return { status: "error", note: "The approval transaction reverted", tx: { hash, status: "failed" } };
        return { status: "done", tx: { hash, status: "confirmed" } };
      }),
    create: () =>
      run("create", async () => {
        const current = await inspectFunding(eth!, prepared);
        if (current.funded) {
          onFunded();
          return { status: "done", note: "Existing escrow verified" };
        }
        const pending = steps.create.tx;
        const hash = pending?.status === "pending" ? pending.hash as `0x${string}` :
          await createJobTx(eth!, current.account, current.escrow, {
          onchainId: prepared.onchainId,
          specHash: prepared.specHash,
          policyHash: prepared.policyHash,
          amount: current.amount,
          deadlineSeconds: prepared.body.deadline_seconds,
        });
        patch("create", { status: "busy", tx: { hash, status: "pending" } });
        const r = await waitForTx(hash);
        if (r !== "success") return { status: "error", note: "createJob reverted. Check the escrow and your USDC balance", tx: { hash, status: "failed" } };
        if (!(await inspectFunding(eth!, prepared)).funded) throw new Error("The escrow did not confirm the job.");
        onFunded();
        return { status: "done", tx: { hash, status: "confirmed" } };
      }),
  };

  // What blocks each step, if anything. Shown instead of a dead button.
  const blocker: Record<StepKey, string | null> = {
    connect: !checked ? "Checking for a wallet…" : !eth ? "No browser wallet found. Install a wallet extension to fund the job." : null,
    network: !account ? "Connect first" : null,
    approve: !escrow ? "Escrow contract isn't deployed yet (set NEXT_PUBLIC_ESCROW_ADDRESS)" : steps.network.status !== "done" ? "Switch network first" : null,
    create: !escrow
        ? "Escrow contract isn't deployed yet"
        : steps.approve.status !== "done"
          ? "Approve first"
          : null,
  };
  const order: StepKey[] = ["connect", "network", "approve", "create"];
  const current = order.find((k) => steps[k].status !== "done");

  return (
    <div className="space-y-5">
      <dl className="grid gap-x-4 gap-y-1 rounded-lg bg-surface-2 p-4 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Budget</dt>
        <dd className="tabular text-ink">{budget} test USDC</dd>
        <dt className="text-muted">Requested funding duration</dt>
        <dd className="tabular text-ink">{prepared.body.deadline_seconds} s</dd>
        <dt className="text-muted">Escrow contract</dt>
        <dd className="break-all font-mono text-ink">{escrow ?? <span className="italic text-muted">not deployed yet</span>}</dd>
        <dt className="text-muted">Job id (on-chain)</dt>
        <dd className="break-all font-mono text-ink-2">{prepared.onchainId}</dd>
        <dt className="text-muted">Spec hash</dt>
        <dd className="break-all font-mono text-ink-2">{prepared.specHash}</dd>
        <dt className="text-muted">Policy hash</dt>
        <dd className="break-all font-mono text-ink-2">{prepared.policyHash}</dd>
        <dt className="text-muted">Dispute window</dt>
        <dd className="tabular text-ink">{config.disputeWindowS} s{config.localChain ? " (local demo)" : ""}</dd>
      </dl>
      {config.localChain && <TruthBadge truth="LOCAL_CHAIN" />}

      <ol className="space-y-3">
        {order.map((k, i) => {
          const s = steps[k];
          const block = s.status === "done" ? null : blocker[k];
          const isCurrent = current === k;
          return (
            <li key={k} className={cx("rounded-lg border p-4", isCurrent ? "border-line-strong bg-surface-2" : "border-line")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusIcon tone={block && isCurrent ? "warning" : toneOf[s.status]} />
                  <span className="font-medium text-ink">
                    {i + 1}. {titles[k]}
                    {k === "approve" && ` (${budget} USDC)`}
                  </span>
                </div>
                {isCurrent && !block && (
                  <Button variant="primary" onClick={actions[k]} disabled={s.status === "busy"}>
                    {s.status === "busy" ? "Check your wallet…" : s.status === "error" ? "Try again" : titles[k].split(" ")[0]}
                  </Button>
                )}
              </div>
              {(s.note || (isCurrent && block)) && (
                <p className="mt-2 pl-7 text-sm text-ink-2">{s.status === "error" || s.note ? s.note : block}</p>
              )}
              {s.tx && (
                <div className="mt-2 pl-7">
                  <TxStatus label={k === "approve" ? "approve" : "createJob"} status={s.tx.status} hash={s.tx.hash} href={explorerTx(s.tx.hash)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
