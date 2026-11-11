"use client";

import Link from "next/link";
import { Gauge, History } from "lucide-react";
import { useSourceControl } from "@/lib/events/source-context";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";

/** What to do from an empty screen: never a dead end. */
export function EmptyActions() {
  const { mode, watchRecording } = useSourceControl();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {mode === "live" && (
        <Button variant="primary" onClick={() => watchRecording(2)}>
          <History className="size-4" aria-hidden /> Watch the recorded run
        </Button>
      )}
      <Link href="/dashboard" className={buttonStyles("secondary", "md")}>
        <Gauge className="size-4" aria-hidden /> Mission control
      </Link>
    </div>
  );
}
