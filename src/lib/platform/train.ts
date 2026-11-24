import { config } from "@/lib/config";
import { PlatformError } from "@/lib/platform/api";
import type { AssistantAnswer } from "@/lib/platform/assistant";

/*
 * The customer journey on the Platform API: recipes, datasets, quotes, orders and jobs (tickets C9 and C12). The site
 * and the API share a host, so the httpOnly session cookie goes with every call.
 */

export type Recipe = {
  recipe_id: string;
  title: string;
  task: string;
  columns: { input: string; answer: string };
  labels: string[];
  metric: string;
  floor: number;
  quality_terms: string;
};
export type Dataset = { dataset_id: string; recipe_id: string; sha256: string; bytes: number; train_rows: number; test_rows: number };
export type Quote = {
  quote_id: string;
  dataset_id: string;
  total_paise: number;
  training_paise: number;
  gst_paise: number;
  eta_minutes: number;
  expires_at: string;
  quality_terms: { metric: string; floor: number; plain_words: string };
  refund_policy: string;
  prices_provisional: boolean;
};
export type Order = { order_id: string; gateway_order_id: string; key_id: string; amount_paise: number; currency: string; status: string };
export type OrderStatus = { order_id: string; status: string; job_id: string | null };
export type CustomerJob = {
  job_id: string;
  state: string;
  stage: "starting" | "training" | "checking" | "passed" | "refunded" | "cancelled";
  recipe_id: string | null;
  recipe_title: string | null;
  base_model: string | null;
  steps_done: number;
  total_steps: number | null;
  moved_devices: number;
  quality: { metric: string; floor: number; score: number | null; passed: boolean | null } | null;
  model_ready: boolean;
  payment: { order_id: string; status: string; amount_paise: number } | null;
};

export const apiBase = () => `${config.coordinatorUrl.replace(/\/$/, "")}/v1`;

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBase() + path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new PlatformError(0, "OFFLINE", "Couldn't reach Ekido. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof data?.error === "string" ? data.error : `HTTP_${response.status}`;
    const detail = typeof data?.detail === "string" ? data.detail : "Something went wrong. Try again.";
    throw new PlatformError(response.status, code, detail);
  }
  return data as T;
}

const id = encodeURIComponent;

export const train = {
  /** The job assistant (decision A1): picks a recipe from plain words. A conversation id carries the previous turn. */
  assistant: (orgId: string, message: string, conversationId?: string) =>
    call<AssistantAnswer>("POST", "/assistant/messages", { message, org_id: orgId, ...(conversationId ? { conversation_id: conversationId } : {}) }),
  recipes: () => call<Recipe[]>("GET", "/recipes"),
  upload: (orgId: string, body: { recipe_id: string; train: Record<string, string>[]; test: Record<string, string>[] }) =>
    call<Dataset>("POST", `/orgs/${id(orgId)}/datasets`, body),
  quote: (orgId: string, datasetId: string) => call<Quote>("POST", `/orgs/${id(orgId)}/quotes`, { dataset_id: datasetId }),
  order: (quoteId: string) => call<Order>("POST", `/quotes/${id(quoteId)}/orders`),
  orderStatus: (orderId: string) => call<OrderStatus>("GET", `/orders/${id(orderId)}`),
  start: (orgId: string, quoteId: string) => call<{ job_id: string }>("POST", `/orgs/${id(orgId)}/jobs`, { quote_id: quoteId }),
  job: (jobId: string) => call<CustomerJob>("GET", `/jobs/${id(jobId)}`),
  jobs: (orgId: string) => call<CustomerJob[]>("GET", `/orgs/${id(orgId)}/jobs`),
};

export const downloadUrl = (modelId: string) => `${apiBase()}/models/${id(modelId)}/download`;
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw new Error("A quoted value is never closed. Check the file for a stray quote mark.");
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/**
 * The recipe's two columns from a CSV, split into train and test. A "split" column (train/test) is used when present;
 * otherwise every fifth row (at least 20) is held back for the test, so the check uses examples the model never saw.
 */
export function rowsForRecipe(rows: string[][], recipe: Recipe): { train: Record<string, string>[]; test: Record<string, string>[] } {
  if (rows.length < 2) throw new Error("The file needs a header row and some examples.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const { input, answer } = recipe.columns;
  const at = (name: string) => header.indexOf(name.toLowerCase());
  if (at(input) < 0 || at(answer) < 0) throw new Error(`The file needs the columns "${input}" and "${answer}". It has: ${rows[0].join(", ")}.`);
  const splitAt = at("split");
  const records = rows.slice(1).map((r) => ({ [input]: (r[at(input)] ?? "").trim(), [answer]: (r[at(answer)] ?? "").trim(), split: splitAt >= 0 ? (r[splitAt] ?? "").trim().toLowerCase() : "" }));
  const strip = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "split"));
  if (splitAt >= 0) {
    return { train: records.filter((r) => r.split !== "test").map(strip), test: records.filter((r) => r.split === "test").map(strip) };
  }
  const testEvery = 5;
  const test = records.filter((_, i) => i % testEvery === testEvery - 1);
  const train = records.filter((_, i) => i % testEvery !== testEvery - 1);
  return { train: train.map(strip), test: test.map(strip) };
}
