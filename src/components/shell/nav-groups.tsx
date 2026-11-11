"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Blocks, ChevronDown, Coins, Gauge, Plus, RotateCcw, Server, ShieldCheck, Wallet } from "lucide-react";
import { config } from "@/lib/config";
import { cx } from "@/components/ui/cx";

/*
 * Four choices instead of ten (Hick's law): the screens are grouped by what a person came to do.
 * Each item says in a few words what it's for, so nobody has to open a page to find out.
 */

type Item = { href: string; label: string; hint: string; icon: typeof Gauge; off?: boolean };
type Group = { label: string; icon: typeof Gauge; href?: string; items?: Item[] };

const newJobOff = !config.signedJobs || config.chainId !== 84532 || !config.escrowAddress;

export const NAV: Group[] = [
  { label: "Mission control", icon: Gauge, href: "/dashboard" },
  {
    label: "Training",
    icon: RotateCcw,
    items: [
      { href: "/recovery", label: "Recovery", hint: "How a run moved when a GPU died", icon: RotateCcw },
      { href: "/quality", label: "Quality", hint: "Why work was accepted or refused", icon: ShieldCheck },
      { href: "/jobs/new", label: "New job", hint: "Lock a budget and start training", icon: Plus, off: newJobOff },
    ],
  },
  {
    label: "Money",
    icon: Coins,
    items: [
      { href: "/settlement", label: "Settlement", hint: "Who got paid, and why", icon: Coins },
      { href: "/chain", label: "On-chain ledger", hint: "Reserves and every payment, live", icon: Blocks },
      { href: "/verify", label: "Verify a payout", hint: "Re-check it yourself in the browser", icon: BadgeCheck },
      { href: "/earnings", label: "Earnings", hint: "What providers made", icon: Wallet },
    ],
  },
  { label: "Providers", icon: Server, href: "/provide" },
];

export function NavGroups({ path }: { path: string }) {
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
      aria-label="Screens"
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
            <Link key={g.label} href={g.href} aria-current={active ? "page" : undefined} className={base}>
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{g.label === "Mission control" ? <><span className="sm:hidden">Mission</span><span className="hidden sm:inline">Mission control</span></> : g.label}</span>
            </Link>
          );
        }
        const isOpen = open === g.label;
        return (
          <div key={g.label} className="relative" onMouseEnter={() => setOpen(g.label)} onMouseLeave={() => setOpen((o) => (o === g.label ? null : o))}>
            <button type="button" aria-expanded={isOpen} aria-haspopup="menu" aria-current={active ? "page" : undefined} onClick={() => setOpen(isOpen ? null : g.label)} className={cx(base, "w-full")}>
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{g.label}</span>
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
                            {i.label}
                            {i.off && <span className="rounded border border-line-strong px-1 text-[10px] font-semibold leading-4 text-muted">Off</span>}
                          </span>
                          <span className="block text-xs text-ink-2">{i.hint}</span>
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
