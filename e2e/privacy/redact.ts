import { createHash } from "node:crypto";

/**
 * Findings must never contain the value they are about. This repo and its Actions logs are public, and with
 * EKIDO_OPERATOR_TOKEN the identities come from the operator's private /providers list. A finding says what kind of
 * thing leaked and where, plus a one-way tag (the first 6 hex characters of the value's SHA-256), which is enough to
 * find it again with the value in hand but not to recover it. Wallets get the same treatment, so one rule covers
 * everything.
 */
export function tag(value: string): string {
  return `sha256 ${createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 6)}`;
}

/** A JSON value, tagged: its type and tag, never the value itself. */
export function tagJson(value: unknown): string {
  return `${Array.isArray(value) ? "array" : typeof value}, ${tag(typeof value === "string" ? value : JSON.stringify(value) ?? "")}`;
}

/**
 * Last line of defence before findings reach a log, a report or a file: if any known identity still appears in one
 * (full, or as a shortened wallet), stop with an error that names none of them.
 */
export function assertRedacted(findings: string[], secrets: Iterable<string>): void {
  const text = findings.join("\n").toLowerCase();
  let leaks = 0;
  for (const s of secrets) {
    const v = s.toLowerCase();
    if (v.length >= 4 && text.includes(v)) leaks++;
    // A wallet shortened as 0x1c4d…337f: its first 6 and last 4 characters.
    if (/^0x[0-9a-f]{40}$/.test(v) && text.includes(v.slice(0, 6)) && text.includes(v.slice(-4))) leaks++;
  }
  if (leaks > 0) throw new Error(`privacy test bug: ${leaks} finding value(s) were not redacted, so nothing is printed`);
}
