"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * How far (in px, along x) to move a popup whose box starts at `left` and is `width` wide so that it stays
 * `margin` px inside a viewport `viewport` px wide. Prefers the left edge when the popup is wider than the room.
 */
export function clampShift(left: number, width: number, viewport: number, margin = 16): number {
  if (left < margin || width > viewport - 2 * margin) return margin - left;
  const overflowRight = left + width - (viewport - margin);
  return overflowRight > 0 ? -overflowRight : 0;
}

/**
 * Keeps an absolutely positioned popup (a header menu anchored to its button) on screen. On phones the header
 * wraps, so a button can sit mid-row and a right-aligned 22rem menu runs off the left edge
 * (ekido-ai/ekido-core#124). Measures when it opens and on resize, and shifts it with the CSS `translate`
 * property, which leaves any Tailwind transform classes alone.
 */
export function useKeepInView<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const place = () => {
      el.style.translate = "";
      const box = el.getBoundingClientRect();
      const dx = clampShift(box.left, box.width, document.documentElement.clientWidth);
      if (dx) el.style.translate = `${dx}px 0`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  return ref;
}
