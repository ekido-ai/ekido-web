import { emptyState, reduce, type DashboardState } from "../events/reduce";
import type { AnyGpuEvent } from "../events/types";

export type Connection = "idle" | "connecting" | "live" | "reconnecting" | "offline";

/**
 * Optional first message from the server (PROPOSED, not in plan.md yet):
 * {"kind":"hello","server":"mock-coordinator","provenance":"sample"}
 * Lets the UI show SAMPLE DATA when the stream is not from a real run.
 */
export interface ServerHello {
  kind: "hello";
  server: string;
  provenance: "live" | "sample" | "recorded";
}

export interface LiveSnapshot {
  state: DashboardState;
  connection: Connection;
  /** Consecutive failed connection attempts. */
  failures: number;
  /** Wall-clock ms of the last message, for staleness. */
  lastMessageAt: number | null;
  hello: ServerHello | null;
  error: string | null;
  url: string;
}

type Listener = () => void;
type WsLike = Pick<WebSocket, "close"> & {
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
};

export interface LiveSourceOptions {
  url: string;
  /** Injected for tests. Defaults to the browser WebSocket. */
  WebSocketImpl?: new (url: string) => WsLike;
  now?: () => number;
  /** After this many failures in a row the state reads "offline" (it keeps retrying). */
  offlineAfter?: number;
  maxBackoffMs?: number;
}

function isEvent(x: unknown): x is AnyGpuEvent {
  return !!x && typeof x === "object" && typeof (x as AnyGpuEvent).seq === "number" && typeof (x as AnyGpuEvent).type === "string";
}

/**
 * Live coordinator stream (WS /ws/jobs/{id}). Same subscribe/getSnapshot shape as the
 * replay player. On reconnect it asks for `?after_seq=<last seq>` (PROPOSED contract) and
 * the reducer drops anything it has already applied, so duplicates are harmless either way.
 */
export class LiveSource {
  private opts: Required<Omit<LiveSourceOptions, "WebSocketImpl">> & Pick<LiveSourceOptions, "WebSocketImpl">;
  private ws: WsLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private listeners = new Set<Listener>();
  private snap: LiveSnapshot;

  constructor(opts: LiveSourceOptions) {
    this.opts = { now: Date.now, offlineAfter: 4, maxBackoffMs: 8000, ...opts };
    this.snap = {
      state: emptyState,
      connection: "idle",
      failures: 0,
      lastMessageAt: null,
      hello: null,
      error: null,
      url: opts.url,
    };
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = () => this.snap;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = ws.onerror = ws.onmessage = ws.onopen = null;
      ws.close();
    }
    this.set({ connection: "idle" });
  }

  /** Forget all received state (e.g. when switching to a different job). */
  reset(url?: string): void {
    const wasRunning = this.running;
    this.stop();
    this.snap = { ...this.snap, state: emptyState, hello: null, error: null, failures: 0, lastMessageAt: null, url: url ?? this.snap.url };
    this.opts.url = this.snap.url;
    this.emit();
    if (wasRunning) this.start();
  }

  private connect(): void {
    const Impl = this.opts.WebSocketImpl ?? (globalThis.WebSocket as unknown as new (url: string) => WsLike);
    const url = new URL(this.opts.url);
    if (this.snap.state.seq >= 0) url.searchParams.set("after_seq", String(this.snap.state.seq));
    this.set({ connection: this.snap.failures > 0 ? this.reconnectingState() : "connecting" });

    let ws: WsLike;
    try {
      ws = new Impl(url.toString());
    } catch (e) {
      this.fail(e instanceof Error ? e.message : "Could not open the connection");
      return;
    }
    this.ws = ws;
    ws.onopen = () => this.set({ connection: "live", failures: 0, error: null });
    ws.onmessage = (ev) => this.onMessage(ev.data);
    ws.onerror = () => this.set({ error: `Connection to ${this.opts.url} failed` });
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.fail(this.snap.error ?? "Connection closed");
    };
  }

  private onMessage(data: unknown): void {
    let msg: unknown;
    try {
      msg = JSON.parse(typeof data === "string" ? data : String(data));
    } catch {
      return; // ignore malformed frames; never crash the dashboard
    }
    const now = this.opts.now();
    if (msg && typeof msg === "object" && (msg as ServerHello).kind === "hello") {
      this.set({ hello: msg as ServerHello, lastMessageAt: now });
      return;
    }
    const list = Array.isArray(msg) ? msg : [msg];
    let state = this.snap.state;
    for (const m of list) if (isEvent(m)) state = reduce(state, m);
    this.set({ state, lastMessageAt: now });
  }

  private reconnectingState(): Connection {
    return this.snap.failures >= this.opts.offlineAfter ? "offline" : "reconnecting";
  }

  private fail(error: string): void {
    if (!this.running) return;
    const failures = this.snap.failures + 1;
    this.snap = { ...this.snap, failures, error };
    this.set({ connection: this.reconnectingState() });
    const delay = Math.min(this.opts.maxBackoffMs, 500 * 2 ** (failures - 1));
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.running) this.connect();
    }, delay);
  }

  private set(patch: Partial<LiveSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
