"use client";

import { Download } from "lucide-react";
import type { DashboardState } from "@/lib/events/reduce";
import { buildReceipt, receiptCsv, type Receipt } from "@/lib/receipt/receipt";
import { Button } from "@/components/ui/button";

function save(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** The job's statement: itemised payouts, the refund, totals, and its transactions. */
export function ReceiptDownload({ state, source }: { state: DashboardState; source: Receipt["source"] }) {
  if (!state.settlement) return null;
  const download = (format: "csv" | "json") => {
    const receipt = buildReceipt(state, new Date().toISOString(), source);
    if (!receipt) return;
    const base = `gpuchain-receipt-${receipt.job_id ?? "job"}`;
    if (format === "csv") save(`${base}.csv`, "text/csv", receiptCsv(receipt));
    else save(`${base}.json`, "application/json", JSON.stringify(receipt, null, 2));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => download("csv")}>
        <Download className="size-4" aria-hidden /> Receipt (CSV)
      </Button>
      <Button onClick={() => download("json")}>
        <Download className="size-4" aria-hidden /> Receipt (JSON)
      </Button>
    </div>
  );
}
