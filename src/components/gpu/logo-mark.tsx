import { cx } from "@/components/ui/cx";

/**
 * The Ekido mark: the sash (tasuki), a diagonal band worn shoulder to hip, on ink. The same drawing as the favicon
 * (app/icon.svg) and the GitHub organisation avatar. Reads at 16 px. See ekido-internal docs/ekido/11-brand-brief.md.
 */
export function LogoMark({ className }: { className?: string }) {
  // A fixed id: the header and footer marks share one identical clip shape, so a repeat is harmless.
  const clip = "ekido-mark-clip";
  return (
    <svg viewBox="0 0 64 64" className={cx("size-7 shrink-0", className)} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill="#1f2a33" />
        <path d="M-6 14 L14 -6 L70 50 L50 70 Z" fill="#e8622c" />
        <path d="M-6 26 L2 18 L46 62 L38 70 Z" fill="#fbf8f3" opacity=".9" />
      </g>
    </svg>
  );
}
