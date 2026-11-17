"use client";

import { connectedCapacityMib, countConnected, formatCapacity, isConnected, sortRoster, statusLabel, type ProviderState, type RosterRow } from "@/lib/live/providers";

/**
 * Every provider the coordinator knows, with whether it is connected and how much memory it offers.
 * `rows` is the provider list from useProviders: null while loading, "down" when the coordinator cannot be read,
 * "private" when it answers but keeps the list to itself.
 */
export function ProviderRoster({ rows }: { rows: ProviderState<RosterRow> }) {
  if (rows === null) return <p className="text-sm text-muted" role="status">Reading the provider list…</p>;
  if (rows === "private") return <p className="text-sm text-muted" role="status">This network keeps its provider list private. Each job still shows which provider ran each step, by a label instead of a name.</p>;
  if (rows === "down") return <p className="text-sm text-muted" role="status">The coordinator did not answer, so the provider list is unavailable. It tries again every 10 seconds.</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">No provider has joined yet.</p>;

  const sorted = sortRoster(rows);
  const connected = countConnected(rows);
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2" aria-live="polite">
        <strong className="text-ink">{connected} of {rows.length}</strong> connected, offering <strong className="text-ink">{formatCapacity(connectedCapacityMib(rows))}</strong> of memory in total. Updates every 10 seconds.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Providers, whether each is connected, and the memory each offers</caption>
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Provider</th>
              <th scope="col" className="px-3 py-2 font-medium">Capacity</th>
              <th scope="col" className="px-3 py-2 font-medium">USDC per step</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const on = isConnected(p.status);
              return (
                <tr key={p.provider_id ?? `${p.name}-${i}`} className="border-t border-line">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className={`size-2 rounded-full ${on ? "bg-success" : "bg-danger"}`} />
                      <span className={on ? "text-ink" : "text-muted"}>{statusLabel(p.status)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink">{p.name ?? "Unnamed provider"}</td>
                  <td className="px-3 py-2 tabular text-ink-2">{formatCapacity(p.capacity_mib)}</td>
                  <td className="px-3 py-2 tabular text-ink-2">{p.price_per_step ? Number(p.price_per_step).toString() : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
