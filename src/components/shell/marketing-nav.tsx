"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Boxes, ChevronDown, Coins, Cpu, Server, Sparkles } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { PRODUCTS, SOLUTIONS, STATUS_LABEL, type Status } from "@/lib/landing/products";

/*
 * The home page's header, like a platform site: Products and Solutions open menus, then Developers, Pricing and
 * Roadmap. Menus open on click or hover, close on Escape, a click outside, or choosing a link.
 */

const ICONS: Record<string, typeof Boxes> = { assistant: Sparkles, train: Boxes, verify: BadgeCheck, host: Server, pay: Coins, devices: Cpu };

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "live" ? "bg-success/10 text-success" : status === "building" ? "bg-accent-soft text-accent-text" : "bg-surface-3 text-muted",
      )}
    >
      {status === "live" && <span className="size-1.5 rounded-full bg-success" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

type Menu = "products" | "solutions" | null;

export function MarketingNav() {
  const [open, setOpen] = useState<Menu>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const trigger = (menu: Exclude<Menu, null>, label: string) => (
    <button
      type="button"
      aria-expanded={open === menu}
      aria-controls={`menu-${menu}`}
      onClick={() => setOpen(open === menu ? null : menu)}
      onMouseEnter={() => setOpen(menu)}
      className={cx("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium", open === menu ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
    >
      {label}
      <ChevronDown className={cx("size-3.5 transition-transform", open === menu && "rotate-180")} aria-hidden />
    </button>
  );
  const plain = (href: string, label: string) => (
    <Link href={href} onClick={() => setOpen(null)} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
      {label}
    </Link>
  );

  return (
    <nav ref={ref} aria-label="Product" className="relative hidden items-center gap-0.5 lg:flex" onMouseLeave={() => setOpen(null)}>
      {trigger("products", "Products")}
      {trigger("solutions", "Solutions")}
      {plain("/#developers", "Developers")}
      {plain("/#pricing", "Pricing")}
      {plain("/#roadmap", "Roadmap")}

      {open === "products" && (
        <div id="menu-products" className="nav-pop absolute left-0 top-full z-50 mt-2 w-[44rem] rounded-3xl border border-line bg-surface p-3 shadow-[0_30px_60px_-30px_rgba(31,42,51,0.45)]">
          <div className="grid grid-cols-2 gap-1">
            {PRODUCTS.map((p) => {
              const Icon = ICONS[p.key] ?? Boxes;
              return (
                <Link key={p.key} href={p.href} onClick={() => setOpen(null)} className="flex gap-3 rounded-2xl p-3 hover:bg-surface-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-[#fbf8f3]">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {p.name} <StatusBadge status={p.status} />
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{p.line}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <Link href="/#products" onClick={() => setOpen(null)} className="mt-2 block rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-3">
            See the whole platform →
          </Link>
        </div>
      )}

      {open === "solutions" && (
        <div id="menu-solutions" className="nav-pop absolute left-16 top-full z-50 mt-2 grid w-[38rem] grid-cols-2 gap-4 rounded-3xl border border-line bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(31,42,51,0.45)]">
          {([["By industry", SOLUTIONS.industries], ["By role", SOLUTIONS.roles]] as const).map(([title, items]) => (
            <div key={title}>
              <p className="kicker mb-2 text-[0.7rem]">{title}</p>
              {items.map((s) => (
                <Link key={s.name} href={s.href} onClick={() => setOpen(null)} className="block rounded-xl p-2.5 hover:bg-surface-2">
                  <span className="block text-sm font-semibold text-ink">{s.name}</span>
                  <span className="block text-[13px] text-ink-2">{s.line}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
