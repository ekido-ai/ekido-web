/**
 * Where a key press on the replay scrubber moves the replay to, or null if the key isn't one of the slider's.
 * The WAI-ARIA slider pattern: arrows step, PageUp/PageDown take a bigger step, Home and End go to the ends
 * (ekido-ai/ekido-core#128). The player clamps out-of-range times itself.
 */
export function scrubTarget(key: string, positionMs: number, durationMs: number): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(0, positionMs - 5_000);
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(durationMs, positionMs + 5_000);
    case "PageDown":
      return Math.max(0, positionMs - 30_000);
    case "PageUp":
      return Math.min(durationMs, positionMs + 30_000);
    case "Home":
      return 0;
    case "End":
      return durationMs;
    default:
      return null;
  }
}
