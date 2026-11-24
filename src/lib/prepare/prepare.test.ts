import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptBytes, isAgeCiphertext, sha256Hex } from "../crypto/age";
import { loadPiiStripperFromBytes } from "../pii/strip";
import { MAX_ROWS, PrepareError, parseCsv, parseDataset, parseJsonl, prepareRows, sealCleaned, summary } from "./prepare";

beforeAll(() => {
  loadPiiStripperFromBytes(readFileSync(new URL("../pii/wasm/ekido_pii_bg.wasm", import.meta.url)));
});

describe("parsing", () => {
  it("reads quoted CSV values, doubled quotes, commas and line breaks inside quotes, CRLF and a BOM", () => {
    const rows = parseCsv('﻿message,label\r\n"Hi, ""Asha"" here",order\r\n"two\nlines",other\r\n');
    expect(rows).toEqual([{ message: 'Hi, "Asha" here', label: "order" }, { message: "two\nlines", label: "other" }]);
  });
  it("refuses cut-off, ragged and duplicate-header files with a plain reason", () => {
    expect(() => parseCsv('a,b\n"open,1')).toThrow(/cut off/);
    expect(() => parseCsv("a,b\n1")).toThrow(/Row 1 has 1 values/);
    expect(() => parseCsv("a,a\n1,2")).toThrow(/different/);
    expect(() => parseCsv("a,b")).toThrow(/at least one row/);
  });
  it("reads JSONL and refuses nested values, arrays and broken lines", () => {
    expect(parseJsonl('{"t":"hi","n":3,"k":null}\n\n{"t":"yo"}\n')).toEqual([{ t: "hi", n: "3", k: "" }, { t: "yo" }]);
    expect(() => parseJsonl('{"t":{"x":1}}')).toThrow(/text, a number or a flag/);
    expect(() => parseJsonl("[1]")).toThrow(/JSON object/);
    expect(() => parseJsonl("{nope")).toThrow(/Line 1/);
    expect(() => parseJsonl("\n")).toThrow(/no rows/);
  });
  it("chooses the parser by file name and refuses other types and too many rows", () => {
    expect(parseDataset("a.csv", "x\n1")).toHaveLength(1);
    expect(parseDataset("a.JSONL", '{"x":"1"}')).toHaveLength(1);
    expect(() => parseDataset("a.xlsx", "")).toThrow(PrepareError);
    expect(() => parseDataset("a.csv", "x\n" + "1\n".repeat(MAX_ROWS + 1))).toThrow(/most we take/);
  });
});

describe("preparing and sealing", () => {
  const rows = [
    { message: "Mera naam Rahul Sharma hai, call 9876543210", label: "complaint" },
    { message: "ORD123456 aaya nahi", label: "order" },
    { message: "mail rahul@example.com", label: "other" },
  ];

  it("removes personal details, keeps the rest, and counts and lists what was removed", () => {
    const p = prepareRows(rows);
    expect(p.rows).toBe(3);
    const cleaned = p.cleanedJsonl.trim().split("\n").map((l) => JSON.parse(l));
    expect(cleaned[0].message).toBe("Mera naam [NAME] hai, call [PHONE]");
    expect(cleaned[1].message).toBe("ORD123456 aaya nahi");
    expect(cleaned[2].message).toBe("mail [EMAIL]");
    expect(p.cleanedJsonl).not.toMatch(/Rahul|9876543210|example\.com/);
    expect(p.counts.NAME).toBe(1);
    expect(p.removals.map((r) => [r.row, r.column, r.type, r.original])).toContainEqual([0, "message", "PHONE", "9876543210"]);
    expect(summary(p.counts)).toEqual(expect.arrayContaining(["1 names", "1 phone numbers", "1 email addresses"]));
  });

  it("seals only the cleaned text: the ciphertext hides it, the hashes match, and only the customer's key opens it", async () => {
    const p = prepareRows(rows);
    const { sealed, identity } = await sealCleaned(p);
    expect(isAgeCiphertext(sealed.blob)).toBe(true);
    expect(sealed.encryption).toBe("age-v1");
    expect(await sha256Hex(sealed.blob)).toBe(sealed.sha256);
    expect(new TextDecoder().decode(sealed.blob)).not.toContain("complaint");
    const plain = new TextDecoder().decode(await decryptBytes(sealed.blob, identity));
    expect(plain).toBe(p.cleanedJsonl);
    expect(plain).not.toMatch(/Rahul|9876543210/);
    expect(sealed.plaintext_bytes).toBe(new TextEncoder().encode(p.cleanedJsonl).length);
  });

  it("with a recipient given, no identity is made and no secret is returned", async () => {
    const { recipient } = await sealCleaned(prepareRows(rows));
    const again = await sealCleaned(prepareRows(rows), recipient);
    expect(again.identity).toBe("");
    expect(again.recipient).toBe(recipient);
  });
});
