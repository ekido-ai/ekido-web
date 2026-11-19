import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { codePointSlice, loadPiiStripperFromBytes, stripRows, stripText } from "./strip";

const wasmPath = new URL("./wasm/ekido_pii_bg.wasm", import.meta.url);

beforeAll(() => {
  loadPiiStripperFromBytes(readFileSync(wasmPath));
});

describe("stripText", () => {
  it("replaces each personal detail with its kind and reports the spans", () => {
    const out = stripText("Mera naam Rahul Sharma hai, call 9876543210 ya rahul@example.com");
    expect(out.redacted).toBe("Mera naam [NAME] hai, call [PHONE] ya [EMAIL]");
    expect(out.spans.map((s) => s.type)).toEqual(["NAME", "PHONE", "EMAIL"]);
  });

  it("leaves text without personal details exactly as it was", () => {
    for (const text of ["", "5 items for Rs 1250", "ORD123456 aaya nahi", "Tracking number 9876543210 shows out for delivery"]) {
      expect(stripText(text).redacted).toBe(text);
    }
  });

  it("counts characters, so spans line up with text that has emoji and Devanagari", () => {
    const text = "नमस्ते 🙂 call 9876543210";
    const out = stripText(text);
    expect(codePointSlice(text, out.spans[0].start, out.spans[0].end)).toBe("9876543210");
    expect(out.redacted).toBe("नमस्ते 🙂 call [PHONE]");
  });

  it("finds an address with its pincode and stops at the pincode", () => {
    const out = stripText("Delivery Flat 358, Green Park, Kochi 682001 pe karna, call 8925935218");
    expect(out.redacted).toBe("Delivery [ADDRESS] pe karna, call [PHONE]");
  });

  it("does not throw on odd input", () => {
    for (const text of ["@", "+91", "Flat", "99999999999999999999999999", "\u0000\u007f", "🙂".repeat(50)]) {
      expect(() => stripText(text)).not.toThrow();
    }
  });
});

describe("stripRows", () => {
  it("strips every cell, lists what was removed for the preview and counts by kind", () => {
    const result = stripRows([
      { text: "Mera number 9876543210 hai", label: "question" },
      { text: "mail me at asha.verma@example.com", label: "other" },
      { text: "koi detail nahi", label: "other" },
    ]);
    expect(result.rows.map((r) => r.text)).toEqual(["Mera number [PHONE] hai", "mail me at [EMAIL]", "koi detail nahi"]);
    expect(result.rows.map((r) => r.label)).toEqual(["question", "other", "other"]);
    expect(result.removals).toEqual([
      { row: 0, column: "text", type: "PHONE", original: "9876543210" },
      { row: 1, column: "text", type: "EMAIL", original: "asha.verma@example.com" },
    ]);
    expect(result.counts.PHONE).toBe(1);
    expect(result.counts.EMAIL).toBe(1);
    expect(result.counts.NAME).toBe(0);
  });

  it("does not change the rows it was given", () => {
    const rows = [{ text: "call 9876543210" }];
    stripRows(rows);
    expect(rows[0].text).toBe("call 9876543210");
  });
});

describe("the module cannot reach the network or the page", () => {
  it("imports nothing but wasm-bindgen's own helpers", () => {
    const compiled = new WebAssembly.Module(readFileSync(wasmPath));
    const imports = WebAssembly.Module.imports(compiled);
    // Today the only import is wasm-bindgen's table set-up; anything else (fetch, DOM, storage...) would show up here.
    expect(imports.map((i) => `${i.module}.${i.name}`)).toEqual(["wbg.__wbindgen_init_externref_table"]);
  });
});
