"use client";

import { useTranslations } from "next-intl";
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
  const tr = useTranslations("demo.gpu");
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
  const caption = tr(`phase.${phase === "idle" && stale ? "lastKnown" : (phase as ChipPhase)}`);

  return (
    <section aria-label={tr("aria")} className="flex flex-col panel rounded-2xl border border-line p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{caption}</h2>
        <span className="truncate text-sm text-ink-2">{id ? providerName(state, id) : tr("noProvider")}</span>
      </div>
      <button type="button" onClick={chipPoke} aria-label={tr("chipAria")} className="device stage-light chip-lime relative mx-auto my-3 grid w-full flex-1 cursor-default place-items-center overflow-hidden !rounded-2xl py-6 outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <ChipScene phase={phase} util={t?.util_pct != null ? t.util_pct / 100 : null} vram={vram} size={150} fieldWidth={290} fieldHeight={250} perSide={6} className="mx-auto" label={p ? p.name.replace(/ \(.*\)$/, "").toUpperCase() : "EKIDO"} />
      </button>
      <p className="truncate text-center text-xs text-muted" title={p?.gpu.model}>
        {p ? (p.gpu.cap_mib ? tr("capped", { model: p.gpu.model.replace(/^NVIDIA GeForce /, ""), mib: p.gpu.cap_mib }) : p.gpu.model.replace(/^NVIDIA GeForce /, "")) : tr("waiting")}
      </p>
      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
        {[
          [tr("cores"), t?.util_pct, "%"],
          [tr("vram"), vram !== null ? vram * 100 : null, "%"],
          [tr("temp"), t?.temp_c, "°C"],
          [tr("power"), t?.power_w, "W"],
        ].map(([label, value, unit]) => (
          <div key={label as string} className="min-w-0">
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="tabular text-sm font-semibold text-ink">
              {value == null ? <span className="font-normal italic text-muted">–</span> : <>{Math.round(value as number)}<span className="font-normal text-ink-2">{unit}</span></>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-center text-[11px] text-muted">{tr("note")}</p>
    </section>
  );
}
