import type { ReactNode } from "react";

/** The opening of a marketing page: a kicker, the headline, a short intro and optional actions. */
export function PageHero({ kicker, title, sub, children }: { kicker: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line bg-surface-2/50">
      <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-16 sm:px-8 lg:pt-20">
        <p className="kicker mb-4">{kicker}</p>
        <h1 className="max-w-3xl text-ink">{title}</h1>
        {sub && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{sub}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

/** A section inside a marketing page. */
export function PageSection({ title, sub, children, id }: { title?: ReactNode; sub?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-20 sm:px-8">
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
