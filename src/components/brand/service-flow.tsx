import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductIcon } from "@/components/brand/product-icons";
import { StatusBadge } from "@/components/shell/marketing-nav";
import { cx } from "@/components/ui/cx";
import { getProducts } from "@/lib/landing/products-server";

/*
 * The one pattern that ties the site together: Ekido is one service with five steps, always in this order. Every product page
 * shows it with "you are here", and the other marketing pages show it as a strip, so a visitor can always see where they
 * are in the whole and step to the part before or after.
 */

export const FLOW = ["assistant", "train", "verify", "host", "pay"] as const;

export async function ServiceFlow({ current }: { current?: string }) {
  const t = await getTranslations("flow");
  const products = await getProducts();
  const byKey = new Map(products.map((p) => [p.key, p]));
  const devices = byKey.get("devices");
  return (
    <div>
      <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {FLOW.map((key, i) => {
          const p = byKey.get(key);
          if (!p) return null;
          const here = key === current;
          return (
            <li key={key} className="relative">
              <Link
                href={p.href}
                aria-current={here ? "page" : undefined}
                className={cx(
                  "artifact lift flex h-full flex-col p-5",
                  here && "border-accent! bg-[color-mix(in_srgb,var(--accent)_6%,white)]",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className={cx("grid size-10 place-items-center rounded-xl", here ? "bg-accent text-white" : "bg-action text-action-ink")}>
                    <ProductIcon name={key} className="size-5" />
                  </span>
                  <span className="figure text-2xl leading-none text-line-strong">{i + 1}</span>
                </span>
                <span className="mt-4 text-[15px] font-semibold text-ink">{p.name}</span>
                <span className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-2">{p.line}</span>
                <span className="mt-auto flex items-center justify-between pt-4">
                  {here ? <span className="kicker">{t("here")}</span> : <StatusBadge status={p.status} />}
                </span>
              </Link>
              {i < FLOW.length - 1 && (
                <ChevronRight className="absolute -right-[1.15rem] top-1/2 z-10 hidden size-5 -translate-y-1/2 text-accent lg:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      {devices && (
        <Link
          href={devices.href}
          aria-current={current === "devices" ? "page" : undefined}
          className={cx(
            "mt-3 flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4 transition-colors hover:bg-surface-2",
            current === "devices" ? "border-accent bg-[color-mix(in_srgb,var(--accent)_6%,white)]" : "border-line bg-surface-2/50",
          )}
        >
          <span className={cx("grid size-9 place-items-center rounded-lg", current === "devices" ? "bg-accent text-white" : "bg-surface text-ink")}>
            <ProductIcon name="devices" className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm text-ink-2">
            <span className="font-semibold text-ink">{t("under")} {devices.name}.</span> {devices.line}
          </span>
          <StatusBadge status={devices.status} />
        </Link>
      )}
    </div>
  );
}

/** The step before and the step after, at the end of a product page. */
export async function ServiceStep({ current }: { current: string }) {
  const t = await getTranslations("flow");
  const products = await getProducts();
  const i = FLOW.indexOf(current as (typeof FLOW)[number]);
  const prev = i > 0 ? products.find((p) => p.key === FLOW[i - 1]) : undefined;
  const next = i >= 0 && i < FLOW.length - 1 ? products.find((p) => p.key === FLOW[i + 1]) : undefined;
  if (!prev && !next) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="artifact lift group flex items-center gap-4 p-5">
          <ArrowLeft className="size-5 shrink-0 text-accent" aria-hidden />
          <span className="min-w-0">
            <span className="kicker">{t("before")}</span>
            <span className="mt-1 block text-lg font-semibold text-ink">{prev.name}</span>
            <span className="line-clamp-1 text-sm text-ink-2">{prev.line}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="artifact lift group flex items-center justify-between gap-4 p-5 text-right">
          <span className="min-w-0 flex-1">
            <span className="kicker">{t("next")}</span>
            <span className="mt-1 block text-lg font-semibold text-ink">{next.name}</span>
            <span className="line-clamp-1 text-sm text-ink-2">{next.line}</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-accent" aria-hidden />
        </Link>
      )}
    </div>
  );
}
