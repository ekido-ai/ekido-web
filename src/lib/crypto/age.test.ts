import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CryptoError, decryptBytes, encryptBytes, encryptStream, isAgeCiphertext, newCustomerKey, sealForUpload, sha256Hex } from "./age";
import vectors from "./vectors/age_vectors.json";

const plaintext = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 7 + 3) % 256);
const b64 = (text: string) => Uint8Array.from(Buffer.from(text, "base64"));

describe("the published age vectors (from ekido-core) decrypt in the browser library", () => {
  it("has the cases the other implementations use", () => {
    expect(vectors.cases.map((c) => c.name).sort()).toEqual(["64kib", "64kib_plus_1", "empty", "one_byte"]);
    expect(vectors.warning).toContain("TEST KEYS");
  });

  for (const vector of vectors.cases) {
    it(`${vector.name}: right key gives the expected bytes and hash`, async () => {
      const ciphertext = b64(vector.ciphertext_base64);
      expect(isAgeCiphertext(ciphertext)).toBe(true);
      const plain = await decryptBytes(ciphertext, vectors.test_identity);
      expect(plain.length).toBe(vector.plaintext_length);
      expect(await sha256Hex(plain)).toBe(vector.plaintext_sha256);
      expect(Array.from(plain)).toEqual(Array.from(plaintext(vector.plaintext_length)));
    });

    it(`${vector.name}: a wrong key and a tampered ciphertext are refused`, async () => {
      await expect(decryptBytes(b64(vector.ciphertext_base64), vectors.wrong_identity)).rejects.toBeInstanceOf(CryptoError);
      await expect(decryptBytes(b64(vector.tampered_ciphertext_base64), vectors.test_identity)).rejects.toBeInstanceOf(CryptoError);
    });
  }
});

describe("encrypting in the browser", () => {
  it("round-trips at the sizes the ticket names", async () => {
    const key = await newCustomerKey();
    for (const size of [0, 1, 64 * 1024, 64 * 1024 + 1]) {
      const data = plaintext(size);
      const blob = await encryptBytes(data, key.recipient);
      expect(isAgeCiphertext(blob)).toBe(true);
      expect(Array.from(await decryptBytes(blob, key.identity))).toEqual(Array.from(data));
    }
  });

  it("round-trips a large stream (5 MiB) without needing it all as one buffer on the way in", async () => {
    const key = await newCustomerKey();
    const data = plaintext(5 * 1024 * 1024);
    const chunks = Array.from({ length: 80 }, (_, i) => data.subarray(i * 65536, (i + 1) * 65536));
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(c));
        controller.close();
      },
    });
    const encrypted = await new Response(await encryptStream(source, key.recipient)).arrayBuffer();
    expect(isAgeCiphertext(new Uint8Array(encrypted))).toBe(true);
    const back = await decryptBytes(new Uint8Array(encrypted), key.identity);
    expect(await sha256Hex(back)).toBe(await sha256Hex(data));
  });

  it("gives a different ciphertext every time and none contains the plaintext", async () => {
    const key = await newCustomerKey();
    const data = new TextEncoder().encode("customer,phone\nasha,not-in-the-ciphertext");
    const [a, b] = [await encryptBytes(data, key.recipient), await encryptBytes(data, key.recipient)];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(Buffer.from(a).includes(Buffer.from("not-in-the-ciphertext"))).toBe(false);
  });

  it("only the right key can read it", async () => {
    const mine = await newCustomerKey();
    const other = await newCustomerKey();
    const blob = await encryptBytes(plaintext(1000), mine.recipient);
    await expect(decryptBytes(blob, other.identity)).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    for (const position of [0, 40, Math.floor(blob.length / 2), blob.length - 1]) {
      const damaged = blob.slice();
      damaged[position] ^= 1;
      await expect(decryptBytes(damaged, mine.identity)).rejects.toBeInstanceOf(CryptoError);
    }
    await expect(decryptBytes(blob.slice(0, blob.length - 20), mine.identity)).rejects.toBeInstanceOf(CryptoError);
  });

  it("refuses a malformed key before doing anything, and never puts a key in an error", async () => {
    const key = await newCustomerKey();
    for (const bad of ["", "age1nope", "AGE-SECRET-KEY-1ABC", "hello", key.identity]) {
      await expect(encryptBytes(plaintext(5), bad)).rejects.toMatchObject({ code: "BAD_RECIPIENT" });
    }
    for (const bad of ["", "age1nope", key.recipient, "AGE-SECRET-KEY-1ABC"]) {
      await expect(decryptBytes(plaintext(50), bad)).rejects.toMatchObject({ code: "BAD_IDENTITY" });
    }
    const failure = await decryptBytes(await encryptBytes(plaintext(10), key.recipient), (await newCustomerKey()).identity).catch((e: Error) => e);
    expect(String((failure as Error).message)).not.toContain("AGE-SECRET-KEY");
    expect(JSON.stringify(failure)).not.toContain(key.identity);
  });

  it("names a blob by the hash of its encrypted bytes and records the plaintext hash separately", async () => {
    const key = await newCustomerKey();
    const data = plaintext(4096);
    const sealed = await sealForUpload(data, key.recipient);
    expect(sealed.sha256).toBe(await sha256Hex(sealed.blob));
    expect(sealed.plaintext_sha256).toBe(await sha256Hex(data));
    expect([sealed.bytes, sealed.plaintext_bytes, sealed.encryption]).toEqual([sealed.blob.length, 4096, "age-v1"]);
    expect(sealed.sha256).not.toBe(sealed.plaintext_sha256);
  });
});

// A blob encrypted here is read by the Python library the coordinator and agent use (and the other way round), so the two agree.
const python = spawnSync("python", ["-c", "import pyrage"], { encoding: "utf8" }).status === 0;
describe.skipIf(!python)("the browser library and pyrage (ekido-core) understand each other", () => {
  const run = (code: string, args: string[]) => spawnSync("python", ["-I", "-c", code, ...args], { encoding: "utf8" });

  it("a blob encrypted in the browser decrypts in Python", async () => {
    const key = await newCustomerKey();
    const data = plaintext(70000);
    const dir = mkdtempSync(join(tmpdir(), "age-"));
    writeFileSync(join(dir, "blob"), await encryptBytes(data, key.recipient));
    const done = run("import sys, pyrage, hashlib; ct=open(sys.argv[1],'rb').read(); print(hashlib.sha256(pyrage.decrypt(ct,[pyrage.x25519.Identity.from_str(sys.argv[2])])).hexdigest())", [join(dir, "blob"), key.identity]);
    expect(done.stdout.trim()).toBe(await sha256Hex(data));
  });

  it("a blob encrypted in Python decrypts in the browser", async () => {
    const key = await newCustomerKey();
    const dir = mkdtempSync(join(tmpdir(), "age-"));
    const done = run("import sys, pyrage; open(sys.argv[1],'wb').write(pyrage.encrypt(bytes((i*7+3)%256 for i in range(70000)),[pyrage.x25519.Recipient.from_str(sys.argv[2])]))", [join(dir, "blob"), key.recipient]);
    expect(done.status).toBe(0);
    expect(Array.from(await decryptBytes(new Uint8Array(readFileSync(join(dir, "blob"))), key.identity))).toEqual(Array.from(plaintext(70000)));
  });
});
