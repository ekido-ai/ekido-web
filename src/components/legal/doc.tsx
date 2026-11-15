import Link from "next/link";
import { config } from "@/lib/config";

/** Shared frame for the plain-language policy and help pages. Server component. */
export function Doc({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl py-4">
      <p className="text-sm text-muted">Last updated {updated}</p>
      <h1 className="mt-1 font-serif text-4xl text-ink">{title}</h1>
      <div className="mt-3 text-lg text-ink-2">{intro}</div>
      <nav aria-label="Related pages" className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-b border-line pb-5 text-sm">
        {[
          ["/help", "Help"],
          ["/status", "Status"],
          ["/privacy", "Privacy"],
          ["/terms", "Terms"],
          ["/security", "Security"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            {label}
          </Link>
        ))}
      </nav>
      <div className="doc mt-6 space-y-8">{children}</div>
    </article>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3 text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
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
