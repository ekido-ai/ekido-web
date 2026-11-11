import { cx } from "./cx";

/** Plain module (no "use client"), so server components can style links as buttons. */
export type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "border border-line-strong bg-surface-2/80 text-ink hover:border-[color-mix(in_srgb,var(--text)_25%,transparent)] hover:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-critical bg-transparent text-ink hover:bg-critical/15",
  /** Armed state of a ConfirmButton: unmistakable. */
  dangerSolid: "border border-critical bg-critical text-white",
};

/** Button look for non-button elements (e.g. a <Link>), so we never nest a button in a link. */
export function buttonStyles(variant: Variant = "secondary", size: "sm" | "md" | "lg" = "md"): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,filter,transform] duration-200 active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" && "px-2.5 py-1 text-sm",
    size === "md" && "px-4 py-2 text-sm",
    size === "lg" && "px-6 py-3 text-lg",
    variants[variant],
  );
}

