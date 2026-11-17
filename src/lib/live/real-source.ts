import { reduceAll, emptyState } from "../events/reduce";
import type { Connection, LiveSnapshot } from "./live-source";
import { translate, type RealEvent, type RealProvider, type SettlementPreview } from "./translate";
import { PRIVATE_RECHECK_MS, retryAfterMs } from "./providers";

const POLL_MS = 3000;
const FILL_MS = 4000;
const REBUILD_MS = 200;
const OFFLINE_AFTER = 3;
const SETTLED_STATES = new Set(["COMPLETED", "SETTLED", "DISPUTED"]);

export interface RealSnapshot extends LiveSnapshot {
  /** The CPU fallback is running, so none of this is the real model. */
  synthetic: boolean;
}

type Listener = () => void;

/** A non-2xx answer. The message keeps the "HTTP 401 from /path" shape that callers and tests match on. */
class HttpError extends Error {
  constructor(readonly status: number, path: string, readonly retryAfter: string | null) {
    super(`HTTP ${status} from ${path}`);
  }
}

const tabHidden = () => typeof document !== "undefined" && document.hidden;

/**
 * Follows the selected job, or the newest job by default. Reconnects by itself, catches up from the last
 * event with no gap below it, and also polls, so anything a socket missed still reaches the screen.
 */
export class RealLiveSource {
  private readonly base: string;
  private readonly listeners = new Set<Listener>();
  private snap: RealSnapshot;
  private running = false;
  private jobId: string | null = null;
  private selectedJob: string | null = null;
  private socket: WebSocket | null = null;
  private socketOpen = false;
  private events = new Map<number, RealEvent>();
  private caughtUp = 0;
  private providers: RealProvider[] = [];
  private preview: SettlementPreview | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private retry: ReturnType<typeof setTimeout> | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  /** The server keeps its provider list private: don't ask again before this time. */
  private providersQuietUntil = 0;
  /** The server answered 429: send nothing before this time. */
  private pausedUntil = 0;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/$/, "");
    this.snap = { state: emptyState, connection: "idle", failures: 0, lastMessageAt: null, hello: null, error: null, url: this.base, synthetic: false };
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snap;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.set({ connection: "connecting" });
    this.openSocket();
    void this.poll();
    this.timers = [setInterval(() => void this.poll(), POLL_MS), setInterval(() => void this.fill(), FILL_MS)];
  }

  stop(): void {
    this.running = false;
    this.timers.forEach(clearInterval);
    this.timers = [];
    if (this.retry) clearTimeout(this.retry);
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = null;
    this.closeSocket();
    this.set({ connection: "idle" });
  }

  reset(): void {
    void this.poll();
  }

  selectJob(jobId: string): void {
    this.selectedJob = jobId;
    if (this.jobId && this.jobId !== jobId) {
      this.forget();
      this.set({ state: emptyState, synthetic: false, connection: "connecting" });
    }
    if (this.running) this.reset();
  }

  private async json<T>(path: string): Promise<T> {
    const response = await fetch(this.base + path, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new HttpError(response.status, path, response.headers.get("retry-after"));
    return (await response.json()) as T;
  }

  /** A 429 is the server asking for less, not an outage: wait as long as it says and keep the screen as it is. */
  private slowDown(error: unknown): boolean {
    if (!(error instanceof HttpError) || error.status !== 429) return false;
    const wait = retryAfterMs(error.retryAfter);
    this.pausedUntil = Date.now() + wait;
    this.set({ error: `The coordinator asked this page to slow down. It resumes in ${Math.ceil(wait / 1000)} s.` });
    return true;
  }

  /** Skip a round while the tab is in the background or the server asked us to wait. */
  private resting(): boolean {
    return tabHidden() || Date.now() < this.pausedUntil;
  }

  private async poll(): Promise<void> {
    if (this.resting()) return;
    const selected = this.selectedJob;
    try {
      const jobsRequest = selected
        ? this.json<{ job_id: string }>(`/jobs/${encodeURIComponent(selected)}`).then((job) => [job])
        : this.json<{ job_id: string }[]>("/jobs?limit=1");
      // A public server keeps its provider list private (401/403): carry on with the jobs, which name providers
      // only by label. Any other failure still counts as the coordinator being unreachable.
      // It is asked again only every few minutes, so a private list costs one request, not one per poll.
      const providersRequest = Date.now() < this.providersQuietUntil
        ? Promise.resolve(this.providers)
        : this.json<RealProvider[]>("/providers").catch((error: unknown) => {
            if (error instanceof Error && /^HTTP (401|403) /.test(error.message)) {
              this.providersQuietUntil = Date.now() + PRIVATE_RECHECK_MS;
              return [] as RealProvider[];
            }
            throw error;
          });
      const [providers, jobs] = await Promise.all([providersRequest, jobsRequest]);
      if (!this.running || selected !== this.selectedJob) return;
      this.providers = providers;
      const newest = jobs[0]?.job_id ?? null;
      if (newest && newest !== this.jobId) this.follow(newest);
      // The coordinator no longer lists the job we follow: it restarted with an empty database.
      // Holding on would wait forever for that job's socket and map its old events onto the new providers.
      else if (!newest && this.jobId) this.forget();
      this.set({ failures: 0, error: null, connection: this.connectionNow(0), lastMessageAt: Date.now(), hello: { kind: "hello", server: "coordinator", provenance: "live" } });
      this.scheduleRebuild();
      await this.refreshSettlement();
    } catch (error) {
      if (!this.running || selected !== this.selectedJob) return;
      if (this.slowDown(error)) return;
      const failures = this.snap.failures + 1;
      const text = error instanceof Error ? error.message : "request failed";
      this.set({ failures, error: `Couldn't reach the coordinator at ${this.base} (${text})`, connection: this.connectionNow(failures) });
    }
  }

  private connectionNow(failures: number): Connection {
    if (failures >= OFFLINE_AFTER) return "offline";
    if (failures > 0) return "reconnecting";
    return !this.jobId || this.socketOpen ? "live" : "connecting";
  }

  private follow(jobId: string): void {
    if (this.retry) clearTimeout(this.retry);
    this.jobId = jobId;
    this.events = new Map();
    this.caughtUp = 0;
    this.preview = null;
    this.closeSocket();
    this.set({ state: emptyState, synthetic: false });
    this.openSocket();
  }

  private forget(): void {
    this.jobId = null;
    this.events = new Map();
    this.caughtUp = 0;
    this.preview = null;
    if (this.retry) clearTimeout(this.retry);
    this.closeSocket();
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.socketOpen = false;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
    }
  }

  private openSocket(): void {
    if (!this.running || !this.jobId) return;
    const socket = new WebSocket(`${this.base.replace(/^http/, "ws")}/ws/jobs/${encodeURIComponent(this.jobId)}?after=${this.caughtUp}`);
    this.socket = socket;
    socket.onopen = () => {
      this.socketOpen = true;
      this.set({ connection: this.connectionNow(this.snap.failures) });
    };
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data));
        if (event.type !== "ping") this.receive([event]);
        this.set({ lastMessageAt: Date.now() });
      } catch {
        /* A malformed frame is never worth crashing the screen. The poll fills any gap. */
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.socketOpen = false;
      this.set({ connection: this.snap.failures >= OFFLINE_AFTER ? "offline" : "reconnecting" });
      this.retry = setTimeout(() => this.openSocket(), 1500);
    };
  }

  private async fill(): Promise<void> {
    const jobId = this.jobId;
    if (!jobId || this.resting()) return;
    try {
      const events = await this.json<RealEvent[]>(`/jobs/${encodeURIComponent(jobId)}/timeline?after=${this.caughtUp}`);
      if (this.running && this.jobId === jobId) this.receive(events);
    } catch (error) {
      this.slowDown(error); // Anything else: poll() reports connection problems.
    }
  }

  private async refreshSettlement(): Promise<void> {
    if (!this.jobId || !SETTLED_STATES.has(this.snap.state.jobState ?? "") || this.preview) return;
    const jobId = this.jobId;
    const id = encodeURIComponent(jobId);
    const [preview, job] = await Promise.all([this.json<Omit<SettlementPreview, "budget">>(`/jobs/${id}/settlement-preview`), this.json<{ budget_usdc: string }>(`/jobs/${id}`)]);
    if (!this.running || this.jobId !== jobId) return;
    this.preview = { ...preview, budget: job.budget_usdc };
    this.scheduleRebuild();
  }

  private receive(incoming: RealEvent[]): void {
    let added = false;
    for (const event of incoming) {
      if (typeof event.id === "number" && !this.events.has(event.id)) {
        this.events.set(event.id, event);
        added = true;
      }
    }
    if (!added) return;
    // Events can arrive out of order, so only count as caught up where there's no gap below.
    while (this.events.has(this.caughtUp + 1)) this.caughtUp += 1;
    this.scheduleRebuild();
  }

  /** Bursts of events only cost one rebuild. */
  private scheduleRebuild(): void {
    if (this.rebuildTimer) return;
    this.rebuildTimer = setTimeout(() => {
      this.rebuildTimer = null;
      const events = [...this.events.values()];
      const state = reduceAll(translate(events, this.providers, { preview: this.preview, nowIso: new Date().toISOString() }));
      this.set({ state, synthetic: events.some((e) => e.provenance === "SYNTHETIC") });
    }, REBUILD_MS);
  }

  private set(patch: Partial<RealSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const listener of this.listeners) listener();
  }
}
