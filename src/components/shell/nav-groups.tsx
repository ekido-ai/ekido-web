"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Blocks, ChevronDown, Coins, Gauge, Plus, RotateCcw, Server, ShieldCheck, Wallet } from "lucide-react";
import { config } from "@/lib/config";
import { cx } from "@/components/ui/cx";
import { useTranslations } from "next-intl";

/*
 * Four choices instead of ten (Hick's law): the screens are grouped by what a person came to do.
 * Each item says in a few words what it's for, so nobody has to open a page to find out.
 */

type Item = { href: string; key: string; icon: typeof Gauge; off?: boolean };
type Group = { key: string; icon: typeof Gauge; href?: string; items?: Item[] };

const newJobOff = !config.signedJobs || config.chainId !== 84532 || !config.escrowAddress;

export const NAV: Group[] = [
  { key: "mission", icon: Gauge, href: "/dashboard" },
  {
    key: "training",
    icon: RotateCcw,
    items: [
      { href: "/recovery", key: "recovery", icon: RotateCcw },
      { href: "/quality", key: "quality", icon: ShieldCheck },
      { href: "/jobs/new", key: "newJob", icon: Plus, off: newJobOff },
    ],
  },
  {
    key: "payments",
    icon: Coins,
    items: [
      { href: "/settlement", key: "settlement", icon: Coins },
      { href: "/chain", key: "ledger", icon: Blocks },
      { href: "/verify", key: "verify", icon: BadgeCheck },
      { href: "/earnings", key: "earnings", icon: Wallet },
    ],
  },
  { key: "earn", icon: Server, href: "/provide" },
];

export function NavGroups({ path }: { path: string }) {
  const t = useTranslations("shell.nav");
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  useEffect(() => setOpen(null), [path]);

  return (
    <nav
      ref={ref}
      aria-label={t("aria")}
      className="order-last -mx-1 grid min-w-0 basis-full grid-cols-4 gap-1 sm:flex 2xl:order-none 2xl:mx-0 2xl:basis-auto 2xl:flex-1"
    >
      {NAV.map((g) => {
        const Icon = g.icon;
        const active = g.href ? path.startsWith(g.href) : !!g.items?.some((i) => path.startsWith(i.href));
        const base = cx(
          "nav-link inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium sm:justify-start sm:px-2.5",
          active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        );
        if (g.href) {
          return (
            <Link key={g.key} href={g.href} aria-current={active ? "page" : undefined} className={base}>
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{g.key === "mission" ? <><span className="sm:hidden">{t("groups.missionShort")}</span><span className="hidden sm:inline">{t("groups.mission")}</span></> : t(`groups.${g.key}`)}</span>
            </Link>
          );
        }
        const isOpen = open === g.key;
        return (
          <div key={g.key} className="relative" onMouseEnter={() => setOpen(g.key)} onMouseLeave={() => setOpen((o) => (o === g.key ? null : o))}>
            <button type="button" aria-expanded={isOpen} aria-haspopup="menu" aria-current={active ? "page" : undefined} onClick={() => setOpen(isOpen ? null : g.key)} className={cx(base, "w-full")}>
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{t(`groups.${g.key}`)}</span>
              <ChevronDown className={cx("size-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <div role="menu" className="nav-pop absolute left-0 top-full z-50 w-72 pt-2">
                <div className="rounded-xl border border-line-strong bg-surface p-1.5 shadow-soft">
                  {g.items!.map((i) => {
                    const ItemIcon = i.icon;
                    const here = path.startsWith(i.href);
                    return (
                      <Link
                        key={i.href}
                        role="menuitem"
                        href={i.href}
                        aria-current={here ? "page" : undefined}
                        className={cx("flex items-start gap-3 rounded-lg px-3 py-2.5", here ? "bg-surface-3" : "hover:bg-surface-2")}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
                          <ItemIcon className="size-4 text-ink" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium text-ink">
                            {t(`items.${i.key}.label`)}
                            {i.off && <span className="rounded border border-line-strong px-1 text-[10px] font-semibold leading-4 text-muted">Off</span>}
                          </span>
                          <span className="block text-xs text-ink-2">{t(`items.${i.key}.hint`)}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
