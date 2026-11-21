import { GPU_CLASSES } from "../../src/lib/pricing";
import { identitiesIn, type Identities } from "./identities";
import { tag, tagJson } from "./redact";

/**
 * What counts as a provider leak (ticket P2, decision 8: no public list or count of who is connected).
 * Each finding is one readable line saying what kind of thing showed and where, with a one-way tag instead of the
 * value (redact.ts): the logs and reports of this public repo must not publish what the test protects.
 */

/** Keys whose value names a provider. Same set as the coordinator's redactor (public_view.py IDENTITY_KEYS). */
const IDENTITY_KEYS = new Set([
  "provider_id", "target_provider_id", "provider", "provider_name", "signer", "expected_signer",
  "wallet_address", "worker_key", "worker_id", "enrolled_key", "session_pubkey", "payees",
]);
/** Hardware fields a public answer shouldn't carry at all. */
const HARDWARE_KEYS = new Set(["gpu_model", "gpu_vram_mib", "compute_cap", "hardware_evidence", "physical_gpu_id", "hostname"]);
/** Keys that would give away how many providers there are. */
const COUNT_KEY = /^(providers?|provider_count|providers_(online|connected|active|count)|(online|connected|active)_providers|n_providers|device_count|devices_online)$/;
/** What the redactor puts in place of a provider identity. */
const REDACTED = /^provider-[0-9a-f]{6}$/;

/** Problems in one public JSON answer. */
export function scanJson(data: unknown, ids: Identities, where: string): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (value === null || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      const at = `${path}.${key}`;
      if (IDENTITY_KEYS.has(key)) {
        const values = (Array.isArray(v) ? v : [v]).filter((x) => x !== null && x !== undefined);
        for (const x of values) if (typeof x !== "string" || !REDACTED.test(x)) found.push(`${where}: ${at} is not redacted (${tagJson(x)})`);
        continue;
      }
      if (HARDWARE_KEYS.has(key) && v !== null) found.push(`${where}: ${at} gives away hardware (${tagJson(v)})`);
      if (COUNT_KEY.test(key) && (typeof v === "number" || Array.isArray(v))) found.push(`${where}: ${at} lists or counts providers`);
      walk(v, at);
    }
  };
  walk(data, "$");
  for (const hit of identitiesIn(JSON.stringify(data), ids)) found.push(`${where}: names a provider (${hit})`); // hit is already redacted
  return found;
}

/**
 * GPU models named on purpose, which are not a provider's hardware:
 * - the price classes on /provide's earnings calculator and where each price comes from (src/lib/pricing.ts
 *   GPU_CLASSES, e.g. "priced below the RTX 4090 range"): a spec anyone may pick, compared with the market;
 * - "our RTX 3060" and the recording of our own run: the team's dev laptop, which is not a provider on the network.
 * Removed from the text before looking for GPU models, so a model mentioned anywhere else still fails.
 */
const ALLOWED_GPU_MENTIONS = [
  ...GPU_CLASSES.flatMap((c) => [c.label, c.source]),
  /\bour RTX 3060( Laptop( GPU)?)?('s)?/gi,
  /\(RTX 3060, local chain\)/g,
  /RTX 3060 Laptop GPU we run on/g,
];
const GPU_MODEL = /\b(?:NVIDIA\s+)?(?:GeForce\s+)?(?:RTX|GTX)\s?\d{3,4}(?:\s?(?:Ti|Super))?\b|\b(?:Tesla|Quadro|Radeon)\s+[A-Z0-9]\w*|\b(?:A10G?|A100|A40|H100|H200|L4|L40S?|T4|V100|MI300X?)\b|\bApple\s+M\d\b/g;

/** GPU models in visible page text, after removing the mentions that aren't a provider's hardware. */
export function gpuModelsIn(text: string, ids: Identities): string[] {
  let rest = text;
  for (const allowed of ALLOWED_GPU_MENTIONS) rest = typeof allowed === "string" ? rest.split(allowed).join(" ") : rest.replace(allowed, " ");
  const hits = new Set<string>();
  for (const m of rest.matchAll(GPU_MODEL)) hits.add(m[0].trim());
  for (const model of ids.gpuModels) if (rest.toLowerCase().includes(model.toLowerCase())) hits.add(model);
  return [...hits];
}

/** Text that counts providers, e.g. "3 providers", "12 GPUs online", "Providers online: 4". */
// "[ \t]" rather than "\s" between the number and the word: a number at the end of one line ("Port 25") and a
// heading on the next ("Provider") are not a count.
const COUNT_TEXT = [
  /\b\d[\d,]*[ \t]+providers?\b/gi,
  /\b\d[\d,]*[ \t]+(?:devices?|GPUs?|nodes?|machines?)[ \t]+(?:online|connected|active|live|registered|available|on-chain)\b/gi,
  // A label and its value can sit on two lines ("Providers online" above "4"), so a line break is allowed here.
  /\b(?:providers?|devices?|GPUs?)[ \t]+(?:online|connected|active|registered)[ \t]*[:·]?\s*\d+/gi,
];
/**
 * Headings that introduce a list of providers: "Providers…", "Connected devices", "Who is online". Singular
 * "Provider identity" or "Provider kit" is about one provider or a concept, not a list.
 */
export const PROVIDER_LIST_HEADING = /^\s*(?:providers\b|connected\s+(?:providers|devices|gpus)|who(?:'s|\s+is)\s+(?:connected|online))/i;

export function countsIn(text: string): string[] {
  return [...new Set(COUNT_TEXT.flatMap((re) => [...text.matchAll(re)].map((m) => m[0])))];
}

/** All findings on one page, redacted: kind and tag, never the text that matched. */
export function pageFindings(page: { text: string; html: string; headings: string[] }, ids: Identities): string[] {
  return [
    ...identitiesIn(page.html, ids).map((hit) => `names a provider (${hit})`),
    ...gpuModelsIn(page.text, ids).map((model) => `GPU model (${tag(model)})`),
    ...countsIn(page.text).map((count) => `provider count (${tag(count)})`),
    ...page.headings.filter((h) => PROVIDER_LIST_HEADING.test(h)).map((h) => `provider list: heading (${tag(h)})`),
  ];
}
