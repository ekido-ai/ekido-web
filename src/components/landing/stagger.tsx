"use client";

import { useEffect, useRef } from "react";

/** Reveals its children one after another when it scrolls into view, like blocks being placed. */
export function Stagger({ children, className = "", step = 110 }: { children: React.ReactNode; className?: string; step?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    Array.from(el.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(i)));
    el.style.setProperty("--step", `${step}ms`);
    el.dataset.ready = "1";
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.dataset.in = "1";
        io.disconnect();
      }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [step]);
  return <div ref={ref} className={`stagger ${className}`}>{children}</div>;
}
