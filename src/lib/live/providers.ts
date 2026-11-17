/**
 * The provider list as the coordinator reports it, kept fresh by polling.
 *
 * The coordinator writes statuses in capitals (ONLINE, BUSY, SUSPECT, OFFLINE). Pages that compared them with
 * lower-case text counted every provider as connected, and pages that read the list once never saw it change.
 */

export type ProviderStatus = { status: string };

/** A provider that is connected and can take or is taking work. SUSPECT (heartbeat late) and OFFLINE are not. */
export function isConnected(status: string | undefined | null): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "online" || s === "busy";
}

export function countConnected(rows: readonly ProviderStatus[]): number {
  return rows.filter((row) => isConnected(row.status)).length;
}

/**
 * null while loading; "down" when the coordinator cannot be read; "private" when it answers but keeps its provider
 * list to itself (a public server refuses /providers with 401 or 403). Private is not an outage.
 */
export type ProviderState<T> = T[] | null | "down" | "private";

/** The fields a roster shows. All of them come from GET /providers. */
export interface RosterRow extends ProviderStatus {
  provider_id?: string;
  name?: string;
  kind?: string;
  capacity_mib?: number | null;
  price_per_step?: string;
}

/** Words for the status, so the state never depends on colour alone. */
export function statusLabel(status: string | undefined | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "online":
      return "Connected";
    case "busy":
      return "Connected, working";
    case "suspect":
      return "Not responding";
    default:
      return "Disconnected";
  }
}

/** "4 GiB", "1.5 GiB", "512 MiB", or a dash when the provider did not say. */
export function formatCapacity(mib: number | null | undefined): string {
  if (typeof mib !== "number" || !Number.isFinite(mib) || mib <= 0) return "–";
  if (mib < 1024) return `${Math.round(mib)} MiB`;
  const gib = mib / 1024;
  return `${Number.isInteger(gib) ? gib : gib.toFixed(1)} GiB`;
}

/** Memory offered by the providers that are connected right now. Disconnected ones offer nothing. */
export function connectedCapacityMib(rows: readonly RosterRow[]): number {
  return rows.reduce(
    (sum, row) => sum + (isConnected(row.status) && typeof row.capacity_mib === "number" && row.capacity_mib > 0 ? row.capacity_mib : 0),
    0,
  );
}

/** Connected providers first, then by name, so the list does not jump about when two have the same state. */
export function sortRoster<T extends RosterRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => Number(isConnected(b.status)) - Number(isConnected(a.status)) || (a.name ?? "").localeCompare(b.name ?? ""));
}

type Fetch = (input: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status?: number; headers?: { get(name: string): string | null }; json(): Promise<unknown> }>;

/** How long a server that said "private" is left alone before asking again. */
export const PRIVATE_RECHECK_MS = 5 * 60_000;

/** Seconds from a Retry-After header, or a safe default when it is missing or unreadable. */
export function retryAfterMs(value: string | null | undefined, fallbackMs = 30_000): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 600) * 1000 : fallbackMs;
}

export interface WatchOptions {
  intervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: Fetch;
  /** Skip a poll while the tab is hidden. Defaults to the page's own visibility. */
  isHidden?: () => boolean;
}

/**
 * Reads `${baseUrl}/providers` now and then every `intervalMs`, and calls `onChange` with the rows, "private" when the
 * server keeps the list to itself, or "down" when the coordinator cannot be read. Returns a function that stops it.
 * A slow answer never overlaps the next request. A private list is asked for again only every PRIVATE_RECHECK_MS, and
 * a 429 keeps the last answer on screen and waits as long as the server's Retry-After says.
 */
export function watchProviders<T extends ProviderStatus>(
  baseUrl: string,
  onChange: (state: ProviderState<T>) => void,
  options: WatchOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? 10_000;
  const timeoutMs = options.timeoutMs ?? 6_000;
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as Fetch);
  const isHidden = options.isHidden ?? (() => typeof document !== "undefined" && document.hidden);
  let stopped = false;
  let inFlight = false;
  let quietUntil = 0;

  const read = async () => {
    if (stopped || inFlight || isHidden() || Date.now() < quietUntil) return;
    inFlight = true;
    try {
      const response = await fetchImpl(`${baseUrl}/providers`, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 401 || response.status === 403) {
        quietUntil = Date.now() + PRIVATE_RECHECK_MS;
        if (!stopped) onChange("private");
        return;
      }
      if (response.status === 429) {
        quietUntil = Date.now() + retryAfterMs(response.headers?.get("retry-after"));
        return;
      }
      if (!response.ok) throw new Error(`providers answered ${String(response.status ?? "")}`);
      const rows = await response.json();
      if (!stopped) onChange(Array.isArray(rows) ? (rows as T[]) : "down");
    } catch {
      if (!stopped) onChange("down");
    } finally {
      inFlight = false;
    }
  };

  void read();
  const timer = setInterval(() => void read(), intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
