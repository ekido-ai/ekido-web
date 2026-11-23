"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Blocks, ChevronDown, Code2, Coins, Gauge, RotateCcw, Server, ShieldCheck, Sparkles, Tag, Wallet } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { useTranslations } from "next-intl";
import { closedMenu, menuReducer, type MenuState } from "./menu-state";

/*
 * Four choices instead of ten (Hick's law): the screens are grouped by what a person came to do.
 * Each item says in a few words what it's for, so nobody has to open a page to find out.
 */

type Item = { href: string; key: string; icon: typeof Gauge; off?: boolean };
type Group = { key: string; icon: typeof Gauge; href?: string; items?: Item[] };


export const NAV: Group[] = [
  // What a customer or device owner came for. Train and My models join this list once they work end to end.
  { key: "train", icon: Sparkles, href: "/train" },
  { key: "developers", icon: Code2, href: "/developers" },
  { key: "earn", icon: Server, href: "/provide" },
  { key: "pricing", icon: Tag, href: "/pricing" },
  {
    // The proof behind the product: live demo, recovery, quality and the public money trail.
    key: "how",
    icon: Gauge,
    items: [
      { href: "/dashboard", key: "mission", icon: Gauge },
      { href: "/recovery", key: "recovery", icon: RotateCcw },
      { href: "/quality", key: "quality", icon: ShieldCheck },
      { href: "/settlement", key: "settlement", icon: Coins },
      { href: "/chain", key: "ledger", icon: Blocks },
      { href: "/verify", key: "verify", icon: BadgeCheck },
      { href: "/earnings", key: "earnings", icon: Wallet },
    ],
  },
];

export function NavGroups({ path }: { path: string }) {
  const t = useTranslations("shell.nav");
  // Hover opens a group's menu and a click keeps it open (menu-state.ts, ekido-ai/ekido-core#123).
  const [{ open }, dispatch] = useReducer(menuReducer<string>, closedMenu as MenuState<string>);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && dispatch({ type: "close" });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && dispatch({ type: "close" });
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  // A new page closes any open menu (adjusting state during render, not in an effect).
  const [shownPath, setShownPath] = useState(path);
  if (shownPath !== path) {
    setShownPath(path);
    dispatch({ type: "close" });
  }

  return (
    <nav
      ref={ref}
      aria-label={t("aria")}
      // On phones each item is as wide as its label and the row spreads them out (ekido-ai/ekido-core#121). With five
      // groups the row can be wider than a small phone, so it scrolls sideways instead of cutting a label short.
      className="order-last -mx-1 flex min-w-0 basis-full justify-between gap-0.5 overflow-x-auto [scrollbar-width:none] sm:justify-start sm:gap-1 sm:overflow-visible 2xl:order-none 2xl:mx-0 2xl:basis-auto 2xl:flex-1"
    >
      {NAV.map((g) => {
        const Icon = g.icon;
        const active = g.href ? path.startsWith(g.href) : !!g.items?.some((i) => path.startsWith(i.href));
        const base = cx(
          "nav-link inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1.5 text-[13px] font-medium sm:min-w-0 sm:shrink sm:justify-start sm:gap-1.5 sm:px-2.5 sm:text-sm",
          active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        );
        if (g.href) {
          return (
            <Link key={g.key} href={g.href} aria-current={active ? "page" : undefined} className={base}>
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{t(`groups.${g.key}`)}</span>
            </Link>
          );
        }
        const isOpen = open === g.key;
        return (
          // Not positioned on phones, so the menu below is placed against the header and fits the screen
          // (ekido-ai/ekido-core#129); from sm up it hangs under its own button.
          <div key={g.key} className="shrink-0 sm:relative" onMouseEnter={() => dispatch({ type: "hover", key: g.key })} onMouseLeave={() => dispatch({ type: "leave" })}>
            <button type="button" aria-expanded={isOpen} aria-haspopup="menu" aria-current={active ? "page" : undefined} onClick={() => dispatch({ type: "click", key: g.key })} className={cx(base, "w-full")}>
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{t(`groups.${g.key}`)}</span>
              <ChevronDown className={cx("size-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <div role="menu" className="nav-pop absolute inset-x-4 top-full z-50 pt-2 sm:inset-x-auto sm:left-0 sm:w-72">
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
