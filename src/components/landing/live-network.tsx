"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseAbi } from "viem";
import { BASE_SEPOLIA, chainClients } from "@/lib/chain/read";
import { usdc } from "@/lib/chain/ledger";
import { countConnected } from "@/lib/live/providers";
import { useProviders } from "@/lib/live/use-providers";
import { ProviderRoster } from "@/components/network/provider-roster";
import type { RosterRow } from "@/lib/live/providers";
import { Stagger } from "./stagger";

/** Live numbers from Base Sepolia and the coordinator, read by the visitor's browser once the section is in view. */
const abi = parseAbi([
  "function totalLocked() view returns (uint256)",
  "function totalWithdrawable() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

interface Snapshot {
  block: bigint;
  held: bigint;
  owed: bigint;
}

export function LiveNetwork() {
  const ref = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [down, setDown] = useState(false);
  // Providers refresh on their own every 10 s; the chain numbers below refresh every 15 s while this is on screen.
  const roster = useProviders<RosterRow>();
  const providers = Array.isArray(roster) ? countConnected(roster) : null;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let alive = true;
    const read = async () => {
      try {
        const { reads } = chainClients();
        const [block, held, locked, withdrawable] = await Promise.all([
          reads.getBlockNumber(),
          reads.readContract({ address: BASE_SEPOLIA.usdc, abi, functionName: "balanceOf", args: [BASE_SEPOLIA.escrow] }),
          reads.readContract({ address: BASE_SEPOLIA.escrow, abi, functionName: "totalLocked" }),
          reads.readContract({ address: BASE_SEPOLIA.escrow, abi, functionName: "totalWithdrawable" }),
        ]);
        if (!alive) return;
        setSnap({ block, held, owed: locked + withdrawable });
        setDown(false);
        setTick((t) => t + 1);
      } catch {
        if (alive) setDown(true);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !timer) {
        void read();
        timer = setInterval(read, 15_000);
      }
    });
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  const coverage = snap ? (snap.owed === BigInt(0) ? 100 : Number((snap.held * BigInt(10000)) / snap.owed) / 100) : null;
  const cells = [
    { k: "Latest block", v: snap ? `#${snap.block.toLocaleString("en-US")}` : "…", note: "Base Sepolia, read just now" },
    { k: "Held by the escrow", v: snap ? `${usdc(snap.held)} USDC` : "…", note: "Test USDC, on-chain" },
    { k: "Reserves cover", v: coverage === null ? "…" : `${Math.min(coverage, 100)}%`, note: "of everything it owes" },
    { k: "Providers online", v: providers === null ? (roster === "down" ? "–" : roster === "private" ? "Private" : "…") : String(providers), note: "From the coordinator" },
  ];

  return (
    <div ref={ref}>
      <Stagger step={90} className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[var(--n-line)] bg-[var(--n-line)] shadow-[0_12px_32px_-18px_rgba(16,24,40,0.14)] lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.k} className="bg-[var(--n-card)] p-5">
            <div className="flex items-center gap-2 text-xs text-[var(--n-slate)]">
              <span className="relative flex size-2" aria-hidden>
                {snap && !down && <span key={tick} className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 [animation-iteration-count:1]" />}
                <span className={`relative inline-flex size-2 rounded-full ${down ? "bg-danger" : snap ? "bg-success" : "bg-[#3a3c40]"}`} />
              </span>
              {c.k}
            </div>
            <div className="mt-2 font-mono text-2xl tracking-tight tabular">{c.v}</div>
            <div className="mt-1 text-xs text-[var(--n-slate)]">{c.note}</div>
          </div>
        ))}
      </Stagger>
      <div className="mt-4 rounded-3xl border border-[var(--n-line)] bg-[var(--n-card)] p-5">
        <ProviderRoster rows={roster} />
      </div>
      <p className="mt-3 text-xs text-[var(--n-slate)]">
        {down ? "Couldn't reach Base Sepolia just now. It retries every 15 seconds." : "Your browser reads these straight from the chain every 15 seconds."}{" "}
        <Link href="/chain" className="text-[var(--n-ink-2)] underline underline-offset-4 hover:text-[var(--n-ink)]">Open the full ledger</Link>
      </p>
    </div>
  );
}
