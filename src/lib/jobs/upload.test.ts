import { describe, expect, it } from "vitest";
import { MAX_JOB_FILE_BYTES, readJobFile } from "./upload";
import { clearToken, loadToken, saveToken } from "./token-store";

const file = (contents: string, size = contents.length) => ({ name: "job_request.json", size, text: async () => contents });

describe("readJobFile", () => {
  it("returns the contents of a normal file", async () => {
    expect(await readJobFile(file('{"job_id":"x"}'))).toBe('{"job_id":"x"}');
  });

  it("drops a byte-order mark that some editors add", async () => {
    expect(await readJobFile(file('﻿{"a":1}'))).toBe('{"a":1}');
  });

  it("refuses an empty file and a file that is only spaces", async () => {
    await expect(readJobFile(file("", 0))).rejects.toThrow(/empty/);
    await expect(readJobFile(file("   \n", 4))).rejects.toThrow(/empty/);
  });

  it("refuses a file over the limit, by its size and by what it really holds", async () => {
    await expect(readJobFile(file("{}", MAX_JOB_FILE_BYTES + 1))).rejects.toThrow(/too large/);
    await expect(readJobFile(file("x".repeat(MAX_JOB_FILE_BYTES + 1), 10))).rejects.toThrow(/too large/);
  });

  it("accepts a file exactly at the limit", async () => {
    const body = "x".repeat(MAX_JOB_FILE_BYTES);
    expect(await readJobFile(file(body))).toHaveLength(MAX_JOB_FILE_BYTES);
  });
});

describe("operator token store", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  };

  it("remembers a token and forgets it on clear", () => {
    const s = memory();
    expect(loadToken(s)).toBe("");
    saveToken("abc", s);
    expect(loadToken(s)).toBe("abc");
    clearToken(s);
    expect(loadToken(s)).toBe("");
  });

  it("does not store an empty token", () => {
    const s = memory();
    saveToken("", s);
    expect(loadToken(s)).toBe("");
  });

  it("works without any storage and survives a storage that throws", () => {
    expect(loadToken(null)).toBe("");
    expect(() => saveToken("abc", null)).not.toThrow();
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(loadToken(broken)).toBe("");
    expect(() => saveToken("abc", broken)).not.toThrow();
    expect(() => clearToken(broken)).not.toThrow();
  });
});
