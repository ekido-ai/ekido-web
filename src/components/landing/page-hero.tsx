import type { ReactNode } from "react";

/** The opening of a marketing page: a kicker, the headline, a short intro and optional actions. */
export function PageHero({ kicker, title, sub, children, art }: { kicker: string; title: ReactNode; sub?: ReactNode; children?: ReactNode; art?: ReactNode }) {
  return (
    <section className="dot-grid relative border-b border-line bg-surface-2/40">
      <div className="pointer-events-none absolute! inset-x-0 top-0 h-80 bg-[radial-gradient(55%_70%_at_30%_0%,rgba(254,80,0,0.10),transparent_72%)]" aria-hidden />
      <div className={`relative mx-auto max-w-[1200px] px-4 pb-20 pt-16 sm:px-8 lg:pt-20 ${art ? "grid items-center gap-6 lg:grid-cols-[1fr_1fr]" : ""}`}>
        <div>
          <p className="kicker mb-4">{kicker}</p>
          <h1 className="max-w-3xl text-ink">{title}</h1>
          {sub && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{sub}</p>}
          {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
        </div>
        {art && <div className="lg:-mr-10">{art}</div>}
      </div>
    </section>
  );
}

/** A section inside a marketing page. */
export function PageSection({ title, sub, children, id }: { title?: ReactNode; sub?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-24 sm:px-8">
      {title && <h2 className="max-w-3xl text-ink">{title}</h2>}
      {sub && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">{sub}</p>}
      <div className={title || sub ? "mt-10" : ""}>{children}</div>
    </section>
  );
}

/** Every marketing page sits in this wrapper, so it gets the home page's type and surfaces. */
export function MarketingPage({ children }: { children: ReactNode }) {
  return <div className="landing -mx-4 -mt-5 overflow-x-clip pb-24 text-ink sm:-mx-6">{children}</div>;
}
