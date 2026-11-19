/**
 * MOCK coordinator for dashboard development. Not Piyush's coordinator, not real data.
 *
 * Speaks the shapes in plan.md section E, plus two PROPOSED additions the dashboard uses:
 *   - first WS message {"kind":"hello","server":"mock-coordinator","provenance":"sample"}
 *   - WS query ?after_seq=N so a reconnect resumes instead of replaying everything
 *
 *   npm run mock                       # http://127.0.0.1:8787, 1x speed
 *   npm run mock -- --speed=4          # faster
 *   npm run mock -- --drop-every=20    # close every socket every 20 s (tests reconnect)
 *   npm run mock -- --port=8787
 *
 * Listens on 127.0.0.1 only.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import type { Recording } from "../src/lib/events/types.ts";

const arg = (name: string, def: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const PORT = Number(arg("port", "8787"));
const SPEED = Math.max(0.1, Number(arg("speed", "1")));
const DROP_EVERY_S = Number(arg("drop-every", "0"));

const here = dirname(fileURLToPath(import.meta.url));
const rec: Recording = JSON.parse(readFileSync(join(here, "recordings", "sample-demo.json"), "utf8"));
const events = [...rec.events].sort((a, b) => a.seq - b.seq);
const t0 = Date.parse(events[0].ts);

/**
 * GET /settlements, shaped like the coordinator's Settlement rows (job_id, status, verdict, txs).
 *   --settlements=123             how many rows (0 = empty state)
 *   --settlements-paging=offset   honours ?offset (default) | ignore (always first page) | missing (404)
 */
const SETTLE_N = Number(arg("settlements", "123"));
const SETTLE_PAGING = arg("settlements-paging", "offset");
const PAYEES = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"];
const settlements = Array.from({ length: SETTLE_N }, (_, i) => {
  const n = SETTLE_N - i; // newest first
  const kind = n % 10 === 0 ? "DISPUTED" : n % 7 === 0 ? "ATTESTED" : n % 13 === 0 ? "FAILED" : "SETTLED";
  const tx = (tag: string) => "0x" + createHash("sha256").update(`${tag}${n}`).digest("hex");
  const a = 2_000_000 + (n % 5) * 250_000;
  const b = n % 3 === 0 ? 0 : 1_000_000;
  const failed = kind === "FAILED";
  return {
    job_id: `job-mock-${String(n).padStart(4, "0")}`,
    job_state: failed ? "REFUNDED" : kind === "DISPUTED" ? "DISPUTED" : kind === "ATTESTED" ? "COMPLETED" : "SETTLED",
    status: kind === "ATTESTED" ? "ATTESTED" : "SETTLED",
    verdict: {
      jobId: tx("job"),
      passed: !failed,
      payees: failed ? [] : b ? PAYEES : [PAYEES[0]],
      amounts: failed ? [] : b ? [a, b] : [a],
      refund: failed ? 10_000_000 : 10_000_000 - a - b,
      expiry: 1_800_000_000,
    },
    submit_tx: tx("submit"),
    finalize_tx: kind === "ATTESTED" ? null : tx("finalize"),
    created_at: new Date(Date.UTC(2026, 10, 7) - i * 60_000).toISOString(),
    mock: true,
  };
});

const idem = new Map<string, { status: number; body: unknown }>();
const jobs = new Map<string, { state: string }>();
const sha = (x: unknown) => "0x" + createHash("sha256").update(JSON.stringify(x)).digest("hex");

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error("body too large");
  }
  return raw ? JSON.parse(raw) : null;
}

/** Replays the original response for a repeated Idempotency-Key (plan.md section E). */
function idempotent(req: IncomingMessage, res: ServerResponse, make: () => { status: number; body: unknown }) {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || !key) return send(res, 400, { error: "MISSING_IDEMPOTENCY_KEY" });
  const prior = idem.get(`${req.url}:${key}`);
  if (prior) return send(res, prior.status, prior.body);
  const out = make();
  idem.set(`${req.url}:${key}`, out);
  send(res, out.status, out.body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return send(res, 204, undefined);
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, server: "mock-coordinator", provenance: "sample" });
    }
    // Lets the live shell connect, with no job to follow.
    if (req.method === "GET" && url.pathname === "/providers") return send(res, 200, []);
    if (req.method === "GET" && url.pathname === "/jobs") return send(res, 200, []);
    // The same shapes staging answers with, so /status and /admin load against the mock (ticket P1).
    if (req.method === "GET" && url.pathname === "/readyz") {
      return send(res, 200, { status: "ready", checks: { database: { ok: true, detail: "mock" }, artifacts: { ok: true, detail: "mock" } } });
    }
    if (req.method === "GET" && url.pathname === "/fees") return send(res, 200, { protocol_fee: null });
    // Platform account routes (/v1, ticket C5), so /settings renders in tests: a signed-in demo person with no team yet.
    if (url.pathname === "/v1/me" && (req.method === "GET" || req.method === "OPTIONS")) {
      // The web app sends the session cookie (credentials: "include"), so a wildcard origin isn't allowed: echo it.
      res.writeHead(req.method === "OPTIONS" ? 204 : 200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": req.headers.origin ?? "*",
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      });
      return res.end(req.method === "OPTIONS" ? "" : JSON.stringify({ user_id: "u_demo", email: "demo@example.com", name: null, orgs: [] }));
    }
    // An empty event index synced to block 60,000,000: the head of the fake chain in e2e/fake-chain.ts (FAKE_BLOCK),
    // so /chain takes the index path in browser tests. Against the real chain it is too far behind and the page scans instead.
    if (req.method === "GET" && url.pathname === "/chain/logs") return send(res, 200, { synced_to: 60_000_000, logs: [] });
    if (req.method === "GET" && url.pathname === "/settlements") {
      if (SETTLE_PAGING === "missing") return send(res, 404, { detail: "Not Found" });
      const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
      const offset = SETTLE_PAGING === "ignore" ? 0 : Number(url.searchParams.get("offset") ?? 0);
      console.log(`[mock] GET /settlements limit=${limit} offset=${offset}`);
      return send(res, 200, settlements.slice(offset, offset + limit));
    }
    if (req.method === "POST" && url.pathname === "/jobs") {
      const body = (await readJson(req)) as { workload?: unknown; policy?: unknown; budget_usdc?: string } | null;
      if (!body?.workload || !body?.policy || !body?.budget_usdc) return send(res, 422, { error: "INVALID_JOB_SPEC" });
      return idempotent(req, res, () => {
        const job_id = `job-${randomUUID().slice(0, 8)}`;
        jobs.set(job_id, { state: "OPEN" });
        console.log(`[mock] POST /jobs → ${job_id}`);
        return {
          status: 201,
          body: {
            job_id,
            onchain_id: "0x" + randomBytes(32).toString("hex"),
            state: "OPEN",
            spec_hash: sha(body.workload),
            policy_hash: sha(body.policy),
            next: { action: "createJob", contract: null },
            mock: true,
          },
        };
      });
    }
    const activate = url.pathname.match(/^\/jobs\/([^/]+)\/activate$/);
    if (req.method === "POST" && activate) {
      return idempotent(req, res, () => {
        const job = jobs.get(activate[1]);
        if (!job) return { status: 404, body: { error: "JOB_NOT_FOUND" } };
        job.state = "ASSIGNED";
        console.log(`[mock] activate ${activate[1]}`);
        return { status: 202, body: { job_id: activate[1], state: "ASSIGNED", mock: true } };
      });
    }
    if (req.method === "POST" && url.pathname === "/demo/faults") {
      const body = (await readJson(req)) as { job_id?: string; kind?: string } | null;
      if (!body?.kind) return send(res, 422, { error: "MISSING_FAULT_KIND" });
      return idempotent(req, res, () => {
        console.log(`[mock] fault ${body.kind} on ${body.job_id} (the sample stream already contains its own kill)`);
        return { status: 202, body: { fault_id: randomUUID(), applied_at: null, label: "INJECTED", mock: true } };
      });
    }
    send(res, 404, { error: "NOT_FOUND" });
  } catch (e) {
    send(res, 400, { error: e instanceof Error ? e.message : "BAD_REQUEST" });
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (!/^\/ws\/jobs\/[^/]+$/.test(url.pathname)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => stream(ws, Number(url.searchParams.get("after_seq") ?? -1)));
});

function stream(ws: WebSocket, afterSeq: number) {
  ws.send(JSON.stringify({ kind: "hello", server: "mock-coordinator", provenance: "sample" }));
  let i = events.findIndex((e) => e.seq > afterSeq);
  if (i === -1) return; // nothing new; keep the socket open
  console.log(`[mock] client connected, streaming from seq ${events[i].seq}`);
  const startWall = Date.now();
  const startOffset = Date.parse(events[i].ts) - t0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const elapsed = (Date.now() - startWall) * SPEED;
    const batch = [];
    while (i < events.length && Date.parse(events[i].ts) - t0 - startOffset <= elapsed) batch.push(events[i++]);
    if (batch.length && ws.readyState === ws.OPEN) ws.send(JSON.stringify(batch.length === 1 ? batch[0] : batch));
    if (i < events.length) {
      const wait = (Date.parse(events[i].ts) - t0 - startOffset - elapsed) / SPEED;
      timer = setTimeout(tick, Math.max(0, wait));
    } else console.log("[mock] stream finished");
  };
  tick();

  const drop = DROP_EVERY_S > 0 ? setTimeout(() => ws.terminate(), DROP_EVERY_S * 1000) : null;
  ws.on("close", () => {
    if (timer) clearTimeout(timer);
    if (drop) clearTimeout(drop);
  });
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`MOCK coordinator on http://127.0.0.1:${PORT}  (speed ${SPEED}x${DROP_EVERY_S ? `, drop every ${DROP_EVERY_S}s` : ""})`);
  console.log("Streams the SAMPLE recording. Not real data.");
});
