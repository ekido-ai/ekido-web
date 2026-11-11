"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BASE_SEPOLIA, latestBlock } from "@/lib/chain/read";
import { cx } from "@/components/ui/cx";

/** A live Base Sepolia block number in the header, so the chain is visible on every screen. */
export function ChainPulse() {
  const [block, setBlock] = useState<bigint | null>(null);
  const [down, setDown] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const b = await latestBlock();
        if (!alive) return;
        setBlock(b);
        setDown(false);
        setTick((t) => t + 1);
      } catch {
        if (alive) setDown(true);
      }
    };
    void read();
    const id = setInterval(read, 12_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/chain"
      title={`${BASE_SEPOLIA.name}, read live by your browser. Opens the on-chain ledger`}
      className="hidden h-9 items-center gap-2 rounded-md border border-line px-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink md:inline-flex"
    >
      <span className="relative flex size-2" aria-hidden>
        {!down && block !== null && <span key={tick} className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60 [animation-iteration-count:1]" />}
        <span className={cx("relative inline-flex size-2 rounded-full", down ? "bg-critical" : block === null ? "bg-muted" : "bg-good")} />
      </span>
      <span className="hidden lg:inline">{BASE_SEPOLIA.name}</span>
      <span className="font-mono text-xs tabular">{down ? "offline" : block === null ? "…" : `#${block.toLocaleString("en-US")}`}</span>
    </Link>
  );
}
