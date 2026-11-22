import { cx } from "@/components/ui/cx";

export const inputClass = "block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink placeholder:text-muted";

/** A labelled input. The label wraps the input, so clicking the text focuses the field. */
export function Field({ label, hint, className, ...input }: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className={cx("block space-y-1 text-sm text-ink", className)}>
      <span className="font-medium">{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}
