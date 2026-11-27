import { useTranslations } from "next-intl";
import { StatusIcon } from "./status";
import { cx } from "./cx";

/**
 * A number always carries its unit and source. Unknown shows as "unknown", never 0.
 */
export function Stat({
  label,
  value,
  unit,
  source,
  digits = 0,
  size = "md",
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  source?: string;
  digits?: number;
  size?: "md" | "lg";
}) {
  const unknown = useTranslations("demo.shared")("unknown");
  const known = value !== null && value !== undefined && !(typeof value === "number" && Number.isNaN(value));
  const shown = !known ? null : typeof value === "number" ? value.toFixed(digits) : value;
  return (
    <div className="min-w-0">
      <div className="text-sm text-ink-2">{label}</div>
      <div className={cx("mt-1 font-serif text-ink", size === "lg" ? "text-4xl" : "text-[1.7rem] leading-tight")}>
        {known ? (
          <>
            {shown}
            {unit && <span className="ml-1 text-base font-normal text-ink-2">{unit}</span>}
          </>
        ) : (
          <span className="text-lg font-normal italic text-muted">{unknown}</span>
        )}
      </div>
      {source && <div className="mt-0.5 text-xs text-muted">{source}</div>}
    </div>
  );
}

/**
 * Horizontal usage meter (e.g. VRAM). Value text is always visible; crossing
 * `warnAt` (a 0..1 fraction) adds a warning icon, not just a color change.
 */
export function Meter({
  label,
  value,
  max,
  unit,
  warnAt = 0.9,
}: {
  label: string;
  value: number | null;
  max: number | null;
  unit: string;
  warnAt?: number;
}) {
  const unknown = useTranslations("demo.shared")("unknown");
  const known = value !== null && max !== null && max > 0;
  const frac = known ? Math.min(1, value / max) : 0;
  const warn = known && frac >= warnAt;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-2">{label}</span>
        <span className="tabular flex items-center gap-1 text-ink">
          {warn && <StatusIcon tone="warning" />}
          {known ? (
            <>
              {Math.round(value)} / {Math.round(max)} {unit}
            </>
          ) : (
            <span className="italic text-muted">{unknown}</span>
          )}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max ?? undefined}
        aria-valuenow={value ?? undefined}
      >
        {known && (
          <div
            className={cx("h-full rounded-full transition-[width] duration-500", warn ? "bg-warning" : "bg-ink-2")}
            style={{ width: `${frac * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
