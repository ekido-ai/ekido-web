"use client";

import { DatasetOpen, DatasetPrep } from "@/components/prepare/dataset-prep";
import { PageHeader } from "@/components/shell/page-header";

export default function PreparePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Prepare your data" kicker="YOUR DATA">
        Remove personal details and lock your file with a key only you hold, all inside your browser, before anything is sent.
      </PageHeader>
      <DatasetPrep />
      <DatasetOpen />
    </div>
  );
}
