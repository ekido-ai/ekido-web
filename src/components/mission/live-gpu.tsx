"use client";

import type { DashboardState } from "@/lib/events/reduce";
import { freshTelemetry, providerName } from "@/lib/events/derive";
import type { ChipPhase } from "@/components/gpu/gpu-chip";
import { ChipScene } from "@/components/gpu/chip-art";
import { chipPoke } from "@/components/gpu/easter-eggs";

/** The GPU doing the work right now, drawn from its telemetry, with the numbers beside it. */
export function LiveGpu({ state, stale }: { state: DashboardState; stale: boolean }) {
  const recovering = state.jobState === "RECOVERING";
  const running = state.jobState === "RUNNING" && !stale;
  const lastProvider = state.progress.at(-1)?.provider_id ?? null;
  const id = state.activeProviderId ?? lastProvider;
  const p = id ? state.providers[id] : undefined;
  const t = id ? freshTelemetry(state, id) : null;

  const phase: ChipPhase = stale
    ? "idle"
    : recovering
      ? "recovering"
      : running && p?.status === "suspect"
        ? "suspect"
        : running
          ? "training"
          : p?.status === "offline"
            ? "off"
            : "idle";
  const total = t?.mem_total_mib ?? p?.gpu.cap_mib ?? p?.gpu.vram_mib ?? null;
  const vram = t?.mem_used_mib != null && total ? t.mem_used_mib / total : null;
  const caption: Record<ChipPhase, string> = {
    training: "Training",
    suspect: "Not responding",
    off: "Stopped",
    recovering: "Moving the run",
    idle: stale ? "Last known" : "Idle",
  };

  return (
    <section aria-label="GPU now" className="flex flex-col panel rounded-2xl border border-line p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{caption[phase]}</h2>
        <span className="truncate text-sm text-ink-2">{id ? providerName(state, id) : "No provider yet"}</span>
      </div>
      <button type="button" onClick={chipPoke} aria-label="The GPU, drawn from its readings" className="device stage-light chip-lime relative mx-auto my-3 grid w-full flex-1 cursor-default place-items-center overflow-hidden !rounded-2xl py-6 outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <ChipScene phase={phase} util={t?.util_pct != null ? t.util_pct / 100 : null} vram={vram} size={150} fieldWidth={290} fieldHeight={250} perSide={6} className="mx-auto" label={p ? p.name.replace(/ \(.*\)$/, "").toUpperCase() : "GPUCHAIN"} />
      </button>
      <p className="truncate text-center text-xs text-muted" title={p?.gpu.model}>
        {p ? `${p.gpu.model.replace(/^NVIDIA GeForce /, "")}${p.gpu.cap_mib ? `, capped at ${p.gpu.cap_mib} MiB` : ""}` : "Waiting for a provider"}
      </p>
      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
        {[
          ["Cores", t?.util_pct, "%"],
          ["VRAM", vram !== null ? vram * 100 : null, "%"],
          ["Temp", t?.temp_c, "°C"],
          ["Power", t?.power_w, "W"],
        ].map(([label, value, unit]) => (
          <div key={label as string} className="min-w-0">
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="tabular text-sm font-semibold text-ink">
              {value == null ? <span className="font-normal italic text-muted">–</span> : <>{Math.round(value as number)}<span className="font-normal text-ink-2">{unit}</span></>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-center text-[11px] text-muted">Drawn from the provider&apos;s own readings. Lit cores follow utilization.</p>
    </section>
  );
}
