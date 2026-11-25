/**
 * RFC 8785 canonical JSON and the document hash, matching packages/ekido_core/ekido_core/canonical.py.
 * ECMAScript number formatting is what RFC 8785 specifies, so JSON.stringify is correct for numbers.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("NaN and Infinity are not valid JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  // RFC 8785 sorts keys by UTF-16 code units, which is JavaScript's default string order.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** SHA-256 hex of the canonical document, without top-level signature fields, as document_hash does. */
export async function documentHash(doc: Record<string, unknown>): Promise<string> {
  const rest = { ...doc };
  delete rest.signature;
  delete rest.sig;
  const bytes = new TextEncoder().encode(canonicalJson(rest));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface FeeTerms {
  bps: number;
  recipient: string;
}

export function feeTerms(spec: Record<string, unknown> | null | undefined): FeeTerms | null {
  const fee = spec?.protocol_fee as FeeTerms | undefined;
  if (!fee || typeof fee.bps !== "number" || typeof fee.recipient !== "string") return null;
  return { bps: fee.bps, recipient: fee.recipient.toLowerCase() };
}
