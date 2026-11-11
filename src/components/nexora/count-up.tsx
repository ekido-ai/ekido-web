"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a number up from zero the first time it scrolls into view.
 * Takes the final text ("24.8%", "0.6 s", "8") and keeps its decimals and suffix.
 * Screen readers and no-JS get the final value straight away.
 */
export function CountUp({ value, ms = 1400 }: { value: string; ms?: number }) {
  const m = value.match(/^([\d.]+)(.*)$/);
  const target = m ? Number(m[1]) : NaN;
  const decimals = m && m[1].includes(".") ? m[1].split(".")[1].length : 0;
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || Number.isNaN(target)) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / ms);
          setN(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, ms]);

  return (
    <span ref={ref} aria-label={value}>
      <span aria-hidden>{n === null || !m ? value : `${n.toFixed(decimals)}${m[2]}`}</span>
    </span>
  );
}
