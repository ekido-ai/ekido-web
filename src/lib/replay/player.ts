import { emptyState, reduce, reduceAll, type DashboardState } from "../events/reduce";
import type { AnyGpuEvent, Recording } from "../events/types";

export interface PlayerSnapshot {
  state: DashboardState;
  /** Milliseconds since the first event. */
  positionMs: number;
  durationMs: number;
  playing: boolean;
  speed: number;
  /** Number of events applied. */
  index: number;
  total: number;
}

type Listener = () => void;

/**
 * Plays a recording into the dashboard reducer with its original timing,
 * scaled by `speed`. Works with React's useSyncExternalStore: `getSnapshot`
 * returns the same object until something changes.
 */
export class ReplayPlayer {
  readonly recording: Recording;
  private readonly events: AnyGpuEvent[];
  private readonly offsets: number[];
  private index = 0;
  private positionMs = 0;
  private playing = false;
  private speed = 1;
  private state: DashboardState = emptyState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private snapshot: PlayerSnapshot;
  /** The snapshot before anything happened, which is what the server rendered. */
  private readonly initial: PlayerSnapshot;

  constructor(recording: Recording) {
    this.recording = recording;
    this.events = [...recording.events].sort((a, b) => a.seq - b.seq);
    const t0 = this.events.length ? Date.parse(this.events[0].ts) : 0;
    this.offsets = this.events.map((e) => Date.parse(e.ts) - t0);
    this.snapshot = this.makeSnapshot();
    this.initial = this.snapshot;
  }

  get durationMs(): number {
    return this.offsets.at(-1) ?? 0;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PlayerSnapshot => this.snapshot;

  /**
   * For useSyncExternalStore's getServerSnapshot: what the server rendered. A part of the page that hydrates after
   * the player has moved (seeked by `?at=`, or played) must still hydrate against the server's HTML, or React
   * throws a hydration error (#418) and re-renders it on the client.
   */
  getServerSnapshot = (): PlayerSnapshot => this.initial;

  play(): void {
    if (this.playing) return;
    if (this.index >= this.events.length) this.seek(0);
    this.playing = true;
    this.schedule();
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.clearTimer();
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, speed);
    if (this.playing) this.schedule();
    this.emit();
  }

  /** Jump to a position. State is rebuilt from scratch, so seeking backwards is exact. */
  seek(ms: number): void {
    const target = Math.min(Math.max(0, ms), this.durationMs);
    let n = 0;
    while (n < this.events.length && this.offsets[n] <= target) n++;
    this.index = n;
    this.positionMs = target;
    this.state = reduceAll(this.events.slice(0, n));
    if (this.playing) this.schedule();
    this.emit();
  }

  /** Apply the next batch of events (all events sharing the next timestamp). */
  stepForward(): void {
    if (this.index >= this.events.length) return;
    this.applyNextBatch();
    if (this.playing) this.schedule();
    this.emit();
  }

  dispose(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  private applyNextBatch(): void {
    const at = this.offsets[this.index];
    while (this.index < this.events.length && this.offsets[this.index] === at) {
      this.state = reduce(this.state, this.events[this.index]);
      this.index++;
    }
    this.positionMs = at;
  }

  private schedule(): void {
    this.clearTimer();
    if (this.index >= this.events.length) {
      this.playing = false;
      return;
    }
    const delay = Math.max(0, (this.offsets[this.index] - this.positionMs) / this.speed);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.applyNextBatch();
      this.schedule();
      this.emit();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private makeSnapshot(): PlayerSnapshot {
    return {
      state: this.state,
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      playing: this.playing,
      speed: this.speed,
      index: this.index,
      total: this.events.length,
    };
  }

  private emit(): void {
    this.snapshot = this.makeSnapshot();
    for (const l of this.listeners) l();
  }
}
