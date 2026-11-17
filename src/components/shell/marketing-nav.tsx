import Link from "next/link";

/** The home page's navigation: sections of the product story, like a product site, instead of the app's screens. */
const LINKS: [string, string][] = [
  ["#product", "Product"],
  ["#use-cases", "Use cases"],
  ["#how", "How it works"],
  ["#owners", "Device owners"],
  ["#faq", "FAQ"],
];

export function MarketingNav() {
  return (
    <nav aria-label="On this page" className="hidden items-center gap-1 md:flex">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
          {label}
        </Link>
      ))}
    </nav>
  );
}
