import { useTranslations } from "next-intl";

/** The opening of an app screen: the same mono label, headline and divider as the public pages, sized for a working screen. */
export function PageHeader({ title, children, aside, kicker }: { title: string; children?: React.ReactNode; aside?: React.ReactNode; kicker?: string }) {
  const t = useTranslations("demo.shared");
  kicker ??= t("kicker");
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="min-w-0">
        <p className="kicker mb-3">{kicker}</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.08]">{title}</h1>
        {children && <div className="mt-2 max-w-3xl text-[1.05rem] leading-relaxed text-ink-2">{children}</div>}
      </div>
      {aside}
    </div>
  );
}
