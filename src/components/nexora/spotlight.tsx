"use client";

import { useEffect, useRef } from "react";

/**
 * Soft light that follows the pointer across its parent section, and publishes the
 * pointer position as --mx/--my (-1..1) on that section so other pieces can react
 * (the hero core tilts toward it). Off for reduced motion and touch.
 */
export function Spotlight({ color = "rgba(255,110,50,0.13)" }: { color?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      el.style.background = `radial-gradient(520px circle at ${x - r.left}px ${y - r.top}px, ${color}, transparent 60%)`;
      host.style.setProperty("--mx", (((x - r.left) / r.width) * 2 - 1).toFixed(3));
      host.style.setProperty("--my", (((y - r.top) / r.height) * 2 - 1).toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      el.style.opacity = "0";
      host.style.setProperty("--mx", "0");
      host.style.setProperty("--my", "0");
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [color]);

  return <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500" />;
}
