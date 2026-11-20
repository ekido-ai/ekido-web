import Link from "next/link";
import { LogoMark } from "@/components/gpu/logo-mark";
import { useTranslations } from "next-intl";

const HREFS: string[][] = [
  ["/developers", "/provide", "/pricing", "/settings"],
  ["/dashboard", "/chain", "/chain#reserves", "/settlement", "/verify", "/status"],
  ["/help", "/#how", "/help#badges", "/security"],
  ["/privacy", "/privacy#cookies", "/terms", "/acceptable-use", "/security"],
];

/** Shared footer for every dashboard screen. The landing page has its own dark version with the same links. */
export function SiteFooter() {
  const t = useTranslations("shell.footer");
  const text = t.raw("columns") as { title: string; links: string[] }[];
  const columns = HREFS.map((hrefs, i) => ({ title: text[i].title, links: hrefs.map((href, j) => [href, text[i].links[j]] as [string, string]) }));
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1840px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
            <LogoMark />
            Ekido
          </Link>
          <p className="mt-3 max-w-xs text-sm text-ink-2">{t("tagline")}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink">{col.title}</span>
            {col.links.map(([href, label]) => (
              <Link key={href + label} href={href} className="text-ink-2 hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1840px] px-4 pb-28 pt-4 text-xs text-muted sm:px-6">
          {t("bottom")}
        </p>
      </div>
    </footer>
  );
}
