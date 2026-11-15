"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/states";
import { buttonStyles } from "@/components/ui/button-styles";

/** A screen crashed. The header, nav and data source keep running; only this page is replaced. */
export default function ScreenError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[Ekido] screen crashed", error);
  }, [error]);
  const detail = error instanceof Error ? error.message : "An unexpected value was thrown";
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-10">
      <ErrorState title="This screen hit an error" detail={detail} onRetry={retry} />
      <p className="text-sm text-ink-2">
        The data stream is unaffected. Try again, or go back to{" "}
        <Link href="/dashboard" className={buttonStyles("ghost", "sm")}>
          Mission control
        </Link>
      </p>
    </div>
  );
}
