import { cx } from "@/components/ui/cx";

/** The Ekido mark: a chip package with an ember die. Same on the landing page and the dashboard. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-7 shrink-0", className)} aria-hidden>
      <g fill="#b08a3e">
        {[9, 14, 19, 24].map((p) => (
          <g key={p}>
            <rect x={p - 1} y="1" width="2" height="4" rx="0.6" />
            <rect x={p - 1} y="27" width="2" height="4" rx="0.6" />
            <rect x="1" y={p - 1} width="4" height="2" rx="0.6" />
            <rect x="27" y={p - 1} width="4" height="2" rx="0.6" />
          </g>
        ))}
      </g>
      <rect x="4" y="4" width="24" height="24" rx="5" fill="#0d0d0d" stroke="#3a3c40" />
      <rect x="9.5" y="9.5" width="13" height="13" rx="2" fill="#ff6a33" />
      <path d="M12 16h2.2l1.4-3 1.8 6 1.4-3H20" fill="none" stroke="#1a0a03" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
