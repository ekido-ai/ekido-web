"use client";

import { useEffect, useRef } from "react";

/**
 * Adds `is-in` once the element scrolls into view, which plays the CSS in
 * globals.css (.reveal fades up, .reveal-tilt settles flat).
 */
export function Reveal({
  children,
  className = "",
  variant = "rise",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "rise" | "tilt";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return;
    // Content already on screen starts visible; offscreen content animates in.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.95) el.classList.add("is-in");
    el.classList.add("reveal-ready");
    const io = new IntersectionObserver(
      ([entry]) => {
        el.classList.toggle("is-in", entry.isIntersecting);
      },
      { rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove("reveal-ready");
      el.classList.remove("is-in");
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`${variant === "tilt" ? "reveal-tilt" : "reveal"} ${className}`}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
