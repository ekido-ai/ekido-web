/**
 * Removes personal details from a customer's rows in the browser, before anything is uploaded (ticket C16).
 *
 * The work is done by `pii/` (Rust, compiled to WebAssembly). The raw rows never leave this function's caller: the
 * module takes text in and gives text out, and has no way to reach the network. It is a safety net, not a guarantee:
 * unusual names and unusual formats can be missed, so the upload screen must show the preview before sending.
 *
 * Rebuild the module with `pii/build.ps1` (or `pii/build.sh`); the built files in ./wasm are committed.
 */

import init, { initSync, strip_json } from "./wasm/ekido_pii";

export type PiiKind = "NAME" | "PHONE" | "EMAIL" | "AADHAAR" | "PAN" | "GSTIN" | "UPI_ID" | "ADDRESS";

/** Offsets are in Unicode characters (code points), not UTF-16 units; use `codePointSlice` to cut text with them. */
export type PiiSpan = { start: number; end: number; type: PiiKind };
export type Stripped = { redacted: string; spans: PiiSpan[] };

/** One thing that was removed, for the preview. `original` stays in the browser and is never sent anywhere. */
export type Removal = { row: number; column: string; type: PiiKind; original: string };
export type StrippedRows = { rows: Record<string, string>[]; removals: Removal[]; counts: Record<PiiKind, number> };

let ready: Promise<void> | null = null;
let loaded = false;

/** Loads the module in the browser (fetches the .wasm file that ships with the app). Safe to call many times. */
export function loadPiiStripper(): Promise<void> {
  ready ??= init({ module_or_path: new URL("./wasm/ekido_pii_bg.wasm", import.meta.url) }).then(() => {
    loaded = true;
  });
  return ready;
}

/** Loads the module from bytes you already have (tests and server-side checks). */
export function loadPiiStripperFromBytes(bytes: BufferSource): void {
  initSync({ module: bytes });
  loaded = true;
  ready = Promise.resolve();
}

export function codePointSlice(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join("");
}

/** Strips one piece of text. Call `loadPiiStripper()` first. */
export function stripText(text: string): Stripped {
  if (!loaded) throw new Error("The personal-detail remover isn't loaded yet; await loadPiiStripper() first.");
  return JSON.parse(strip_json(text)) as Stripped;
}

const KINDS: PiiKind[] = ["NAME", "PHONE", "EMAIL", "AADHAAR", "PAN", "GSTIN", "UPI_ID", "ADDRESS"];

/** Strips every cell of every row, and lists what was removed so the customer can check it before uploading. */
export function stripRows(rows: Record<string, string>[]): StrippedRows {
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<PiiKind, number>;
  const removals: Removal[] = [];
  const cleaned = rows.map((row, index) => {
    const next: Record<string, string> = {};
    for (const [column, value] of Object.entries(row)) {
      const result = stripText(value ?? "");
      for (const span of result.spans) {
        counts[span.type] += 1;
        removals.push({ row: index, column, type: span.type, original: codePointSlice(value, span.start, span.end) });
      }
      next[column] = result.redacted;
    }
    return next;
  });
  return { rows: cleaned, removals, counts };
}
