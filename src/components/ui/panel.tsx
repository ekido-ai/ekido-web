import { cx } from "./cx";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("panel rounded-2xl border border-line", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[1.05rem] font-semibold text-ink [overflow-wrap:anywhere]">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-6", bodyClassName)}>{children}</div>
    </section>
  );
}
