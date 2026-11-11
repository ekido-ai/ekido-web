import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import { cx } from "./cx";

/**
 * Status is never color alone: every tone has its own icon and a text label.
 * The four status colors are reserved and never used for series identity.
 */
export type Tone = "good" | "warning" | "serious" | "critical" | "active" | "neutral" | "idle";

const tones: Record<Tone, { icon: typeof Circle; color: string; spin?: boolean }> = {
  good: { icon: CircleCheck, color: "text-good" },
  warning: { icon: TriangleAlert, color: "text-warning" },
  serious: { icon: OctagonAlert, color: "text-serious" },
  critical: { icon: CircleX, color: "text-critical" },
  active: { icon: LoaderCircle, color: "text-ink", spin: true },
  neutral: { icon: Circle, color: "text-ink-2" },
  idle: { icon: CircleDashed, color: "text-muted" },
};

export function StatusIcon({ tone, className }: { tone: Tone; className?: string }) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <Icon
      aria-hidden
      className={cx("size-4 shrink-0", t.color, t.spin && "animate-spin motion-reduce:animate-none", className)}
    />
  );
}

export function StatusPill({
  tone,
  children,
  size = "md",
}: {
  tone: Tone;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 font-medium text-ink backdrop-blur",
        size === "lg" ? "px-3 py-1 text-base" : "px-2.5 py-0.5 text-sm",
      )}
    >
      <StatusIcon tone={tone} className={size === "lg" ? "size-5" : undefined} />
      {children}
    </span>
  );
}
