/**
 * The upload screen's logic (tickets C16 and A14): read the customer's file, remove personal details, show what was removed,
 * then seal what is left so it can be uploaded. Everything here runs in the browser; the raw file is never sent anywhere.
 *
 * Accepted files: CSV (first line is the column names, quotes and doubled quotes understood) or JSONL (one flat JSON object per line).
 * The cleaned rows are written back as JSONL, which is what the training recipe reads.
 */

import { sealForUpload, newCustomerKey, type Sealed } from "../crypto/age";
import { stripRows, type PiiKind, type Removal } from "../pii/strip";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 50_000;

export class PrepareError extends Error {}

export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((v) => v !== "")) records.push(record);
      record = [];
    } else field += c;
  }
  if (quoted) throw new PrepareError("A quoted value is never closed, so the file looks cut off.");
  record.push(field);
  if (record.some((v) => v !== "")) records.push(record);
  if (records.length < 2) throw new PrepareError("The file needs a header line and at least one row.");
  const header = records[0].map((h) => h.trim());
  if (header.some((h) => h === "") || new Set(header).size !== header.length) throw new PrepareError("Every column needs a different, non-empty name.");
  return records.slice(1).map((values, index) => {
    if (values.length !== header.length) throw new PrepareError(`Row ${index + 1} has ${values.length} values but there are ${header.length} columns.`);
    return Object.fromEntries(header.map((h, k) => [h, values[k]]));
  });
}

export function parseJsonl(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const [index, line] of text.replace(/^﻿/, "").split(/\r?\n/).entries()) {
    if (line.trim() === "") continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new PrepareError(`Line ${index + 1} is not valid JSON.`); }
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PrepareError(`Line ${index + 1} must be a JSON object.`);
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean" && v !== null) throw new PrepareError(`Line ${index + 1}: "${k}" must be text, a number or a flag.`);
      row[k] = v === null ? "" : String(v);
    }
    rows.push(row);
  }
  if (rows.length === 0) throw new PrepareError("The file has no rows.");
  return rows;
}

export function parseDataset(fileName: string, text: string): Record<string, string>[] {
  const rows = /\.csv$/i.test(fileName) ? parseCsv(text) : /\.jsonl?$/i.test(fileName) || /\.ndjson$/i.test(fileName) ? parseJsonl(text) : null;
  if (rows === null) throw new PrepareError("Use a .csv or .jsonl file.");
  if (rows.length > MAX_ROWS) throw new PrepareError(`That is ${rows.length} rows; the most we take is ${MAX_ROWS}.`);
  return rows;
}

export type Prepared = {
  cleanedJsonl: string;
  rows: number;
  counts: Record<PiiKind, number>;
  removals: Removal[];
};

/** Removes personal details from every cell. `load` is `loadPiiStripper` in the browser. Nothing is sealed yet: the customer checks the preview first. */
export function prepareRows(rows: Record<string, string>[]): Prepared {
  const { rows: cleaned, removals, counts } = stripRows(rows);
  return { cleanedJsonl: cleaned.map((r) => JSON.stringify(r)).join("\n") + "\n", rows: cleaned.length, counts, removals };
}

export type SealedDataset = { sealed: Sealed; identity: string; recipient: string };

/** Seals the cleaned file to a fresh key made here. The identity (the secret) is for the customer to keep; it is never sent. */
export async function sealCleaned(prepared: Prepared, recipient?: string): Promise<SealedDataset> {
  const key = recipient ? { identity: "", recipient } : await newCustomerKey();
  const sealed = await sealForUpload(new TextEncoder().encode(prepared.cleanedJsonl), key.recipient);
  return { sealed, identity: key.identity, recipient: key.recipient };
}

/** A short, plain-words line for each kind of thing removed. */
export function summary(counts: Record<PiiKind, number>): string[] {
  const words: Record<PiiKind, string> = { NAME: "names", PHONE: "phone numbers", EMAIL: "email addresses", AADHAAR: "Aadhaar numbers", PAN: "PAN numbers", GSTIN: "GSTINs", UPI_ID: "UPI IDs", ADDRESS: "addresses" };
  return (Object.keys(words) as PiiKind[]).filter((k) => counts[k] > 0).map((k) => `${counts[k]} ${words[k]}`);
}
