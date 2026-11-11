import { cx } from "./cx";

/**
 * Provider identity: fixed categorical slot per provider id, never by rank,
 * and always shown with its name so identity is never color alone.
 */
const slotById: Record<string, string> = {
  A: "bg-series-1",
  B: "bg-series-2",
  R: "bg-series-3",
  C: "bg-series-4",
};

export function providerSwatch(id: string): string {
  // Unknown providers (and P, the injected-fault trainer) get a neutral swatch.
  return slotById[id] ?? "bg-muted";
}

export function ProviderChip({ id, name, className }: { id: string; name?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium text-ink", className)}>
      <span className={cx("size-2.5 shrink-0 rounded-sm", providerSwatch(id))} aria-hidden />
      {name ?? `Provider ${id}`}
    </span>
  );
}
