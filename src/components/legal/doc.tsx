import { Children, isValidElement } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { config } from "@/lib/config";
import { MarketingPage, PageHero } from "@/components/landing/page-hero";

/** Shared frame for the plain-language policy and help pages: a page header, a sticky contents list and the text. */
export function Doc({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  const t = useTranslations("shell.legal");
  const sections = Children.toArray(children)
    .filter(isValidElement)
    .map((c) => (c.props as { id?: string; title?: string }))
    .filter((p) => p.title)
    .map((p) => ({ id: p.id ?? slug(p.title!), title: p.title! }));
  return (
    <MarketingPage>
      <PageHero kicker={t("kicker", { date: updated.toUpperCase() })} title={title} sub={intro}>
        <nav aria-label={t("related")} className="flex flex-wrap gap-2 text-sm">
          {(
            [
              ["/help", "help"],
              ["/status", "status"],
              ["/privacy", "privacy"],
              ["/terms", "terms"],
              ["/acceptable-use", "acceptableUse"],
              ["/security", "security"],
            ] as const
          ).map(([href, key]) => (
            <Link key={href} href={href} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-2 hover:border-line-strong hover:text-ink">
              {t(`links.${key}`)}
            </Link>
          ))}
        </nav>
      </PageHero>
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-14 sm:px-8 lg:grid-cols-[220px_1fr] lg:gap-16">
        {sections.length > 1 && (
          <aside className="hidden lg:block">
            <nav aria-label={t("onThisPage")} className="sticky top-24 space-y-1 text-sm">
              <p className="kicker mb-3">{t("onThisPageKicker")}</p>
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block border-l-2 border-line py-1 pl-3 text-ink-2 hover:border-accent hover:text-ink">
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>
        )}
        <article className="doc max-w-3xl space-y-10">{children}</article>
      </div>
    </MarketingPage>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id ?? slug(title)} className="scroll-mt-24 space-y-3 text-[15.5px] leading-relaxed text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li]:mt-1.5 [&_strong]:text-ink">
      <h2 className="text-2xl font-bold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function Contact() {
  return config.contactEmail ? (
    <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
  ) : (
    <span>the Ekido team</span>
  );
}
