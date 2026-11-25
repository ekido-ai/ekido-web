import { Cpu, FlaskConical, History, Layers, Link2, Server, Zap, Calculator } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { cx } from "./cx";

/**
 * Truth badges say what a thing really is. They are part of the design, not small print.
 * Neutral by default; only the two that change how a judge should read the screen
 * (an injected fault, sample data) carry a caution border.
 */
export type Truth =
  | "REAL"
  | "REAL_SEPARATE"
  | "CAPPED_PROFILE"
  | "INJECTED_FAULT"
  | "RECORDED"
  | "SAMPLE"
  | "LOCAL_CHAIN"
  | "SYNTHETIC";

// Labels and hover titles are in messages (shell.truth.<TRUTH>).
const spec: Record<Truth, { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; tone: string }> = {
  REAL: { icon: Cpu, tone: "border-line-strong" },
  REAL_SEPARATE: { icon: Server, tone: "border-line-strong" },
  CAPPED_PROFILE: { icon: Layers, tone: "border-line-strong" },
  INJECTED_FAULT: { icon: Zap, tone: "border-serious" },
  RECORDED: { icon: History, tone: "border-line-strong" },
  SAMPLE: { icon: FlaskConical, tone: "border-warning" },
  SYNTHETIC: { icon: Calculator, tone: "border-warning" },
  LOCAL_CHAIN: { icon: Link2, tone: "border-warning" },
};

/** `wrap` lets a long label break inside a narrow card instead of being cut off. */
export function TruthBadge({ truth, className, wrap = false }: { truth: Truth; className?: string; wrap?: boolean }) {
  const t = useTranslations("shell.truth");
  const s = spec[truth];
  const Icon = s.icon;
  return (
    <span
      title={t(`${truth}.title`)}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border bg-surface-2 px-2 py-0.5",
        "text-xs font-semibold uppercase tracking-wide text-ink",
        wrap ? "max-w-full" : "whitespace-nowrap",
        s.tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(`${truth}.label`)}
    </span>
  );
}
