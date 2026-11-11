"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts from the last shown value to the new one, so a change in money is seen, not just noticed later.
 * Respects reduced motion. The final text is always the exact formatted value.
 */
export function AnimatedNumber({ value, format, duration = 900, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
    if (reduce || !Number.isFinite(value)) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={`tabular ${className ?? ""}`}>{format(shown)}</span>;
}
