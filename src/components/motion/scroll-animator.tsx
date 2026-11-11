"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Site-wide scroll reveal: cards below the fold rise into place, a few at a time, as they come into view.
 * Cards already on screen when a page opens are left alone, so nothing flickers. Also catches cards that
 * render later, after data loads. Off for reduced motion.
 */
const SELECTOR = "main .panel, main [data-reveal-me]";

export function ScrollAnimator() {
  const path = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off") return;
    document.documentElement.classList.add("anim-scroll");
    let batch = 0;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.setProperty("--reveal-delay", `${Math.min(batch, 6) * 70}ms`);
          batch += 1;
          el.dataset.shown = "1";
          io.unobserve(el);
        }
        clearTimeout(batchTimer);
        batchTimer = setTimeout(() => (batch = 0), 120);
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const seen = new WeakSet<Element>();
    const adopt = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        // Already visible: show it as is. Below the fold: prepare it to rise in.
        el.dataset.reveal = "1";
        if (r.top < window.innerHeight * 0.92) el.dataset.shown = "1";
        else io.observe(el);
      });
    };
    adopt();
    const mo = new MutationObserver(() => adopt());
    const main = document.querySelector("main");
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      clearTimeout(batchTimer);
    };
  }, [path]);
  return null;
}
