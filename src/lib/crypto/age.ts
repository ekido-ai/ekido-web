/**
 * Encrypts a customer's data in the browser, in the standard age format, before it is uploaded (ticket A14).
 *
 * Every job has its own age key. The browser gets only its public half (the recipient, `age1...`) and encrypts the dataset to it, so
 * Ekido's servers never hold the plaintext. The finished model is encrypted to the customer's own recipient and decrypted here with
 * their identity (`AGE-SECRET-KEY-1...`), which never leaves the browser.
 *
 * This is a thin layer over the maintained `age-encryption` package: no cryptography is written here. Rules kept:
 * - a secret key is never put in an error message, a log line or a URL;
 * - a wrong key, or any change to the data, is refused (never wrong plaintext);
 * - the stored blob is named by the SHA-256 of its own (encrypted) bytes, as in the checkpoint manifest (GPCK/2).
 *
 * The same published vectors (`vectors/age_vectors.json`, from ekido-core) are checked in the tests.
 * Say "encrypted from your browser to the device training your model", never "private training".
 */

import { Decrypter, Encrypter, generateIdentity, identityToRecipient } from "age-encryption";

const AGE_HEADER = new TextEncoder().encode("age-encryption.org/v1\n");
const RECIPIENT = /^age1[0-9a-z]{50,}$/;
const IDENTITY = /^AGE-SECRET-KEY-1[0-9A-Z]{50,}$/;

/** A fixed, safe message: it never contains a key, a name or any part of the data. */
export class CryptoError extends Error {
  constructor(
    readonly code: "BAD_RECIPIENT" | "BAD_IDENTITY" | "ENCRYPT_FAILED" | "DECRYPT_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "CryptoError";
  }
}

function checkRecipient(recipient: string): void {
  if (typeof recipient !== "string" || !RECIPIENT.test(recipient)) {
    throw new CryptoError("BAD_RECIPIENT", "The encryption key for this job is not valid.");
  }
}

function checkIdentity(identity: string): void {
  if (typeof identity !== "string" || !IDENTITY.test(identity)) {
    throw new CryptoError("BAD_IDENTITY", "That is not a valid secret key.");
  }
}

export function isAgeCiphertext(blob: Uint8Array): boolean {
  return blob.length >= AGE_HEADER.length && AGE_HEADER.every((byte, i) => blob[i] === byte);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Encrypts `data` to `recipient`. */
export async function encryptBytes(data: Uint8Array, recipient: string): Promise<Uint8Array> {
  checkRecipient(recipient);
  try {
    const encrypter = new Encrypter();
    encrypter.addRecipient(recipient);
    return await encrypter.encrypt(data);
  } catch {
    throw new CryptoError("ENCRYPT_FAILED", "The data could not be encrypted.");
  }
}

/** Encrypts a stream (a large file) to `recipient`, so the whole file need not sit in memory. */
export async function encryptStream(stream: ReadableStream<Uint8Array>, recipient: string): Promise<ReadableStream<Uint8Array>> {
  checkRecipient(recipient);
  try {
    const encrypter = new Encrypter();
    encrypter.addRecipient(recipient);
    return await encrypter.encrypt(stream);
  } catch {
    throw new CryptoError("ENCRYPT_FAILED", "The data could not be encrypted.");
  }
}

/** Decrypts with `identity`. A wrong key, or any change to the ciphertext, raises a `CryptoError`. */
export async function decryptBytes(ciphertext: Uint8Array, identity: string): Promise<Uint8Array> {
  checkIdentity(identity);
  try {
    const decrypter = new Decrypter();
    decrypter.addIdentity(identity);
    return await decrypter.decrypt(ciphertext);
  } catch {
    throw new CryptoError("DECRYPT_FAILED", "The data could not be decrypted: wrong key, or the data was changed.");
  }
}

/** What the upload needs for one encrypted file: the blob to send, and the fields the manifest and the job record. */
export type Sealed = { blob: Uint8Array; sha256: string; bytes: number; plaintext_sha256: string; plaintext_bytes: number; encryption: "age-v1" };

/** Encrypts `plain` for upload. The blob's name in storage is `sha256`, the hash of the encrypted bytes. */
export async function sealForUpload(plain: Uint8Array, recipient: string): Promise<Sealed> {
  const blob = await encryptBytes(plain, recipient);
  return { blob, sha256: await sha256Hex(blob), bytes: blob.length, plaintext_sha256: await sha256Hex(plain), plaintext_bytes: plain.length, encryption: "age-v1" };
}

/** A new key pair for the customer's own downloads. Keep the identity in the browser only; show or save it once. */
export async function newCustomerKey(): Promise<{ identity: string; recipient: string }> {
  const identity = await generateIdentity();
  return { identity, recipient: await identityToRecipient(identity) };
}
