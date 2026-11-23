"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Keeps what someone typed into a server-rendered field before the page's script loaded.
 *
 * A controlled input's state starts empty. Text typed before hydration sits in the DOM but never reaches that state:
 * - submitting reads the empty state ("Enter a full email address" on /login);
 * - a button stays disabled (/jobs/new);
 * - the next render writes the empty state back over the field (/verify).
 *
 * See ekido-ai/ekido-core#125.
 *
 * This reads the field once, right after hydration (a layout effect runs before any later render can overwrite it),
 * and hands the text to the state setter on the next tick (not inside the effect: react-hooks/set-state-in-effect).
 */
export function useTypedBeforeHydration(ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>, set: (value: string) => void) {
  useLayoutEffect(() => {
    const typed = ref.current?.value;
    if (!typed) return;
    const timer = setTimeout(() => set(typed), 0);
    return () => clearTimeout(timer);
  }, [ref, set]);
}
