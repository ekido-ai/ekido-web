"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Paragraph whose words darken one by one as it scrolls through the viewport.
 * Reduced motion: shown fully revealed.
 */
export function ScrollReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");
  const [shown, setShown] = useState(words.length);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = () => document.documentElement.dataset.motion === "off" || (document.documentElement.dataset.motion !== "on" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let raf = 0;
    const update = () => {
      raf = 0;
      if (reduced()) return setShown(words.length);
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top enters at 85% of the viewport, 1 when the bottom reaches 45%.
      const start = vh * 0.85;
      const end = vh * 0.45;
      const p = (start - r.top) / (start - end + r.height);
      setShown(Math.round(Math.min(1, Math.max(0, p)) * words.length));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("ekido:motion", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("ekido:motion", onScroll);
    };
  }, [words.length]);

  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span
          key={i}
          aria-hidden
          className="transition-colors duration-300"
          style={{ color: i < shown ? "var(--n-ink)" : "var(--n-faint)" }}
        >
          {w}{" "}
        </span>
      ))}
    </p>
  );
}
