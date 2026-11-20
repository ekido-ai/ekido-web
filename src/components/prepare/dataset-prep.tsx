"use client";

import { useState } from "react";
import { Download, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { decryptBytes, isAgeCiphertext } from "@/lib/crypto/age";
import { loadPiiStripper } from "@/lib/pii/strip";
import { MAX_FILE_BYTES, PrepareError, parseDataset, prepareRows, sealCleaned, summary, type Prepared, type SealedDataset } from "@/lib/prepare/prepare";

function save(name: string, data: BlobPart, type = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const problem = (e: unknown) => (e instanceof PrepareError ? e.message : "Something went wrong reading that file. Nothing was sent anywhere.");

export function DatasetPrep() {
  const [name, setName] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [checked, setChecked] = useState(false);
  const [sealed, setSealed] = useState<SealedDataset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    setPrepared(null); setSealed(null); setChecked(false); setError("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(`That file is ${(file.size / 1048576).toFixed(1)} MB; the most we take is ${MAX_FILE_BYTES / 1048576} MB.`); return; }
    setBusy(true);
    try {
      await loadPiiStripper();
      setName(file.name);
      setPrepared(prepareRows(parseDataset(file.name, await file.text())));
    } catch (e) { console.error("prepare failed", e); setError(problem(e)); } finally { setBusy(false); }
  }

  async function seal() {
    if (!prepared) return;
    setBusy(true); setError("");
    try { setSealed(await sealCleaned(prepared)); } catch { setError("Could not encrypt. Nothing was sent anywhere."); } finally { setBusy(false); }
  }

  const found = prepared ? summary(prepared.counts) : [];
  return (
    <Panel title="1. Prepare your data" subtitle="Everything on this page happens in your browser. Your original file is never uploaded.">
      <div className="space-y-4">
        <label className="block text-sm text-ink-2">
          Choose a .csv or .jsonl file
          <input type="file" accept=".csv,.jsonl,.json,.ndjson" className="mt-1 block w-full text-sm" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {busy && <p className="text-sm text-ink-2" role="status">Working…</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {prepared && (
          <div className="space-y-3">
            <p className="text-sm text-ink" role="status">
              <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden />
              {prepared.rows} rows in {name}. {found.length ? `Removed ${found.join(", ")}.` : "No personal details were found."}
            </p>
            {prepared.removals.length > 0 && (
              <div className="max-h-64 overflow-auto rounded border border-line text-sm">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface text-left text-ink-2"><tr><th className="p-2">Row</th><th className="p-2">Column</th><th className="p-2">Kind</th><th className="p-2">Removed (only you see this)</th></tr></thead>
                  <tbody>
                    {prepared.removals.slice(0, 200).map((r, i) => (
                      <tr key={i} className="border-t border-line"><td className="p-2">{r.row + 1}</td><td className="p-2">{r.column}</td><td className="p-2">{r.type}</td><td className="p-2 font-mono">{r.original}</td></tr>
                    ))}
                  </tbody>
                </table>
                {prepared.removals.length > 200 && <p className="p-2 text-ink-2">Showing the first 200 of {prepared.removals.length}.</p>}
              </div>
            )}
            <p className="text-sm text-ink-2">This is a safety net, not a guarantee: unusual names and formats can be missed. Please read the cleaned data before you send it.</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
              I have looked at what was removed and I am happy to send the cleaned rows.
            </label>
            <Button variant="primary" disabled={!checked || busy} onClick={seal}>Encrypt the cleaned file</Button>
          </div>
        )}
        {sealed && prepared && (
          <div className="space-y-3 rounded border border-line p-3">
            <p className="text-sm text-ink" role="status">Encrypted ({sealed.sealed.bytes} bytes). Only your key opens it.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save("dataset.jsonl.age", sealed.sealed.blob as BlobPart)}><Download className="mr-1 h-4 w-4" aria-hidden />Download encrypted file</Button>
              <Button onClick={() => save("ekido-key.txt", `${sealed.identity}\n`, "text/plain")}><KeyRound className="mr-1 h-4 w-4" aria-hidden />Download your key</Button>
            </div>
            <p className="text-sm text-ink-2">Keep the key somewhere safe. We never see it, so we cannot recover it. Without it, nobody (including us) can open your file, and you cannot open it later.</p>
            <p className="break-all font-mono text-xs text-ink-2">sha256 {sealed.sealed.sha256}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function DatasetOpen() {
  const [blob, setBlob] = useState<Uint8Array | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    setBlob(null); setError("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES * 2) { setError("That file is too large."); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isAgeCiphertext(bytes)) { setError("That is not an encrypted file made by this page."); return; }
    setBlob(bytes);
  }

  async function open() {
    if (!blob) return;
    setBusy(true); setError("");
    try { save("dataset-opened.jsonl", (await decryptBytes(blob, key.trim())) as BlobPart, "application/x-ndjson"); }
    catch { setError("That key does not open this file."); } finally { setBusy(false); }
  }

  return (
    <Panel title="2. Open an encrypted file" subtitle="For your own files or results. The key is used in this browser only.">
      <div className="space-y-3">
        <label className="block text-sm text-ink-2">Encrypted file (.age)<input type="file" accept=".age" className="mt-1 block w-full text-sm" onChange={(e) => onFile(e.target.files?.[0])} /></label>
        <label className="block text-sm text-ink-2">Your key (starts with AGE-SECRET-KEY-)<input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 block w-full rounded border border-line bg-surface p-2 font-mono text-sm" /></label>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Button variant="primary" disabled={!blob || !key.trim() || busy} onClick={open}>Decrypt and download</Button>
      </div>
    </Panel>
  );
}
