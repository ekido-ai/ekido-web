import type { Truth } from "@/components/ui/truth-badge";
import type { Provenance } from "./source-context";

/**
 * The badge a screen shows for where its data came from.
 * Live data has none: only a recording or sample data is labelled.
 */
export function recordingTruth(provenance: Provenance): Extract<Truth, "RECORDED" | "SAMPLE"> | null {
  if (provenance === "live") return null;
  return provenance === "sample" ? "SAMPLE" : "RECORDED";
}
