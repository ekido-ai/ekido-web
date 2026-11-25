"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  const mo = new MutationObserver(cb);
  mq.addEventListener("change", cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
}
const motionOff = () => window.matchMedia(REDUCE).matches || document.documentElement.dataset.motion === "off";

/**
 * Counts from the last shown value to the new one, so a change in money is seen, not just noticed later.
 * Respects reduced motion. The final text is always the exact formatted value.
 */
export function AnimatedNumber({ value, format, duration = 900, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  // The server renders the final value, so there it counts as no motion.
  const reduce = useSyncExternalStore(subscribeMotion, motionOff, () => true);
  const still = reduce || !Number.isFinite(value);
  useEffect(() => {
    if (still) {
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
  }, [value, duration, still]);
  return <span className={`tabular ${className ?? ""}`}>{format(still ? value : shown)}</span>;
}
