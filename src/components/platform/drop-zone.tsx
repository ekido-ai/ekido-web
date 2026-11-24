"use client";

import { useId, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

/*
 * P4 (ekido-ai/ekido-internal#45): the upload drop zone. It checks the file's type, size and emptiness and hands a
 * good file to its parent. It never reads the contents or uploads anything itself.
 * States: idle, drag-over, reading, wrong type, too big, empty, chosen.
 */

export type DropProblem = "wrong-type" | "too-big" | "empty";

/** Why a file can't be used, or null. `accept` is a list of extensions such as [".csv"]. */
export function checkFile(file: { name: string; size: number }, accept: readonly string[], maxBytes: number): DropProblem | null {
  const name = file.name.toLowerCase();
  if (!accept.some((ext) => name.endsWith(ext.toLowerCase()))) return "wrong-type";
  if (file.size > maxBytes) return "too-big";
  if (file.size === 0) return "empty";
  return null;
}

/** "12.3 KB", "4.0 MB": the size a person reads, in powers of 1024. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropZone({
  accept,
  maxBytes,
  onFile,
  reading = null,
  chosen = null,
  disabled = false,
}: {
  accept: readonly string[];
  maxBytes: number;
  onFile: (file: File) => void;
  /** The name of a file the parent is still reading. */
  reading?: string | null;
  /** The file the parent accepted. */
  chosen?: { name: string; size: number } | null;
  disabled?: boolean;
}) {
  const t = useTranslations("train");
  const inputId = useId();
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<{ kind: DropProblem; name: string } | null>(null);
  const mb = Math.round(maxBytes / (1024 * 1024));

  const take = (file: File | undefined) => {
    if (!file || disabled) return;
    const kind = checkFile(file, accept, maxBytes);
    setProblem(kind ? { kind, name: file.name } : null);
    if (!kind) onFile(file);
  };

  const message = problem
    ? t(problem.kind === "wrong-type" ? "dropWrongType" : problem.kind === "too-big" ? "dropTooBig" : "dropEmpty", { file: problem.name, mb })
    : null;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        data-state={reading ? "reading" : over ? "over" : chosen ? "chosen" : problem ? "problem" : "idle"}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files[0]);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          disabled && "cursor-not-allowed opacity-60",
          over ? "border-accent bg-accent-soft" : problem ? "border-critical bg-surface" : chosen ? "border-good bg-surface" : "border-line-strong bg-surface-2 hover:border-ink",
        )}
      >
        {chosen && !reading && !over ? <FileText className="size-7 text-ink" aria-hidden /> : <UploadCloud className="size-7 text-ink-2" aria-hidden />}
        <span className="font-semibold text-ink" aria-live="polite">
          {reading ? t("dropReading", { file: reading }) : over ? t("dropActive") : chosen ? t("dropChosen", { file: chosen.name, size: fileSize(chosen.size) }) : t("dropTitle")}
        </span>
        <span className="text-sm text-ink-2">{chosen && !over && !reading ? t("dropAnother") : t("dropHint", { mb })}</span>
        <input
          id={inputId}
          type="file"
          accept={accept.join(",")}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            take(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {message && (
        <p role="alert" className="text-sm text-critical">
          {message}
        </p>
      )}
    </div>
  );
}
