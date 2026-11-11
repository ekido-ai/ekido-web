import { Cpu, FlaskConical, History, Layers, Link2, Server, Zap, Calculator } from "lucide-react";
import type { ComponentType } from "react";
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

const spec: Record<
  Truth,
  { label: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; tone: string; title: string }
> = {
  REAL: { label: "Real GPU", icon: Cpu, tone: "border-line-strong", title: "A physical GPU running this work live" },
  REAL_SEPARATE: {
    label: "Real · separate machine",
    icon: Server,
    tone: "border-line-strong",
    title: "A physical GPU on a different machine",
  },
  CAPPED_PROFILE: {
    label: "Capped profile · same GPU",
    icon: Layers,
    tone: "border-line-strong",
    title: "The same physical GPU with a memory cap enforced by PyTorch's allocator. Not a different architecture",
  },
  INJECTED_FAULT: {
    label: "Injected fault",
    icon: Zap,
    tone: "border-serious",
    title: "We caused this on purpose to show how the system reacts",
  },
  RECORDED: {
    label: "Recorded",
    icon: History,
    tone: "border-line-strong",
    title: "Captured from an earlier real run, played back",
  },
  SAMPLE: {
    label: "Sample data",
    icon: FlaskConical,
    tone: "border-warning",
    title: "Hand-authored fixture. Numbers are illustrative, not measured",
  },
  SYNTHETIC: {
    label: "Synthetic workload",
    icon: Calculator,
    tone: "border-warning",
    title: "A small CPU workload stands in for the real GPU training. The pipeline is the same, the model is not",
  },
  LOCAL_CHAIN: {
    label: "Local chain",
    icon: Link2,
    tone: "border-warning",
    title: "Running on a local Anvil chain, not Base Sepolia",
  },
};

/** `wrap` lets a long label break inside a narrow card instead of being cut off. */
export function TruthBadge({ truth, className, wrap = false }: { truth: Truth; className?: string; wrap?: boolean }) {
  const s = spec[truth];
  const Icon = s.icon;
  return (
    <span
      title={s.title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border bg-surface-2 px-2 py-0.5",
        "text-xs font-semibold uppercase tracking-wide text-ink",
        wrap ? "max-w-full" : "whitespace-nowrap",
        s.tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {s.label}
    </span>
  );
}
