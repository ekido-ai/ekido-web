"use client";

import Link from "next/link";
import { useSourceControl } from "@/lib/events/source-context";

/** Set the source before a client-side transition; the root layout survives navigation. */
export function DashboardLink({ mode, className, children }: { mode: "live" | "recorded"; className?: string; children: React.ReactNode }) {
  const { setMode, watchRecording } = useSourceControl();
  return (
    <Link
      href={mode === "recorded" ? "/dashboard?at=0&play=1" : "/dashboard?source=live"}
      className={className}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (mode === "recorded") watchRecording(1);
        else setMode("live");
      }}
    >
      {children}
    </Link>
  );
}
