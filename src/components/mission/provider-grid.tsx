import { Cpu, Server } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DashboardState } from "@/lib/events/reduce";
import type { EventPayloads, ProviderStatus } from "@/lib/events/types";
import { freshTelemetry, providerNotes } from "@/lib/events/derive";
import { providerSwatch } from "@/components/ui/provider-chip";
import { StatusIcon, StatusPill, type Tone } from "@/components/ui/status";
import { TruthBadge, type Truth } from "@/components/ui/truth-badge";
import { EmptyState } from "@/components/ui/states";
import { cx } from "@/components/ui/cx";

type Provider = EventPayloads["provider.updated"];

const statusView: Record<ProviderStatus, { tone: Tone; label: string }> = {
  busy: { tone: "active", label: "Training" },
  online: { tone: "neutral", label: "Online" },
  suspect: { tone: "warning", label: "Not responding" },
  offline: { tone: "critical", label: "Offline" },
};

const evidenceText = {
  CLAIMED: { word: "claimed, unchecked", title: "The provider says so. Nobody checked" },
  OBSERVED: { word: "self-reported", title: "Read by the provider's own agent (NVML). Not independently verified" },
  MEASURED: { word: "benchmarked", title: "Nonce-challenged benchmark, still run by the provider" },
  VERIFIER_CHECKED: { word: "verifier-checked", title: "Derived from results our verifiers accepted" },
} as const;

/** One compact reading: value in ink, unit and label muted. Unknown stays "unknown". */
function Reading({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted">{label} </span>
      {value === null ? (
        <span className="italic text-muted">unknown</span>
      ) : (
        <span className="tabular font-semibold text-ink">
          {Math.round(value)}
          <span className="font-normal text-ink-2">{unit}</span>
        </span>
      )}
    </span>
  );
}

/** Profiles share one GPU, so its readings belong to the GPU, once, not to each card. */
function GpuReadings({ list, state }: { list: Provider[]; state: DashboardState }) {
  const tele = list.map((p) => freshTelemetry(state, p.provider_id)).find(Boolean);
  if (!tele) return <span className="text-sm italic text-muted">No live telemetry</span>;
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
      <Reading label="GPU" value={tele.util_pct} unit="%" />
      <Reading label="VRAM" value={tele.mem_used_mib} unit=" MiB" />
      <Reading label="Temp" value={tele.temp_c} unit="°C" />
      <Reading label="Power" value={tele.power_w} unit="W" />
      <span className="text-xs text-muted">reported by the provider&apos;s agent</span>
    </p>
  );
}

function ProviderCard({ p, state }: { p: Provider; state: DashboardState }) {
  const st = statusView[p.status];
  // On the CPU fallback nothing here is a real GPU, so "REAL GPU" would be a lie.
  const onCpu = p.gpu.model === "CPU";
  const truth: Truth = p.kind === "INJECTED_FAULT" ? p.kind : onCpu ? "SYNTHETIC" : p.kind === "REAL" ? (p.separate_machine ? "REAL_SEPARATE" : "REAL") : p.kind;
  const active = state.activeProviderId === p.provider_id && state.jobState === "RUNNING";
  const notes = providerNotes(state, p.provider_id);
  const ev = evidenceText[p.gpu.evidence];
  const letter = p.provider_id.length === 1 ? p.provider_id : (p.name.match(/^Provider ([A-Z])\b/)?.[1] ?? "?");
  return (
    <article
      aria-label={p.name}
      className={cx("flex min-w-0 flex-col gap-2 rounded-xl border bg-surface p-3", active ? "border-ink-2 ring-1 ring-ink-2" : "border-line")}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cx("grid size-9 shrink-0 place-items-center rounded-lg text-lg font-bold text-white", providerSwatch(letter))}
          aria-hidden
        >
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-tight text-ink">{p.name.replace(/ \(.*\)$/, "")}</div>
          <div className="mt-1">
            <StatusPill tone={active ? "active" : st.tone}>{active ? "Training now" : st.label}</StatusPill>
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <TruthBadge truth={truth} wrap />
      </div>
      <p className="text-sm text-ink-2" title={onCpu ? "Synthetic CPU provider; no GPU telemetry" : ev.title}>
        <span className="tabular text-ink">
          {onCpu ? "CPU" : p.gpu.cap_mib ? `${p.gpu.cap_mib} MiB cap` : `${p.gpu.vram_mib} MiB`}
        </span>
        {" · "}
        <span className="tabular">{p.price_per_step_usdc.replace(/0+$/, "")} USDC/step</span>
      </p>
      {notes.length > 0 && (
        <ul className="space-y-1 border-t border-line pt-2 text-sm">
          {notes.map((n) => (
            <li key={n.text} className="flex items-start gap-1.5 text-ink">
              <StatusIcon tone={n.tone} className="mt-0.5 size-3.5 shrink-0" />
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * Providers grouped by the physical GPU they run on, so it is obvious that capped
 * profiles are the same hardware (plan.md: "say this out loud in the demo").
 */
export function ProviderGrid({ state }: { state: DashboardState }) {
  const t = useTranslations("demo.shared");
  const providers = Object.values(state.providers);
  if (providers.length === 0) {
    return <EmptyState title={t("noProvidersTitle")}>{t("noProviders")}</EmptyState>;
  }
  const groups = new Map<string, Provider[]>();
  for (const p of providers) groups.set(p.physical_gpu_id, [...(groups.get(p.physical_gpu_id) ?? []), p]);

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([gpuId, list]) => {
        const g = list[0].gpu;
        const separate = list.some((p) => p.separate_machine);
        const Icon = separate ? Server : Cpu;
        const model = g.model.replace(/^NVIDIA GeForce /, "");
        return (
          <section key={gpuId} aria-label={g.model === "CPU" ? "Synthetic CPU providers" : `Physical GPU ${g.model}`}>
            <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon className="size-4 text-ink-2" aria-hidden />
                {g.model === "CPU" ? (
                  "This computer's CPU, no GPU: a small synthetic workload"
                ) : (
                  <>
                    {separate ? "Separate machine" : list.length > 1 ? "One physical GPU, different memory caps" : "One physical GPU"}: {model}
                    {g.vram_mib ? `, ${g.vram_mib} MiB` : ""}
                  </>
                )}
              </h3>
              {/* On the CPU fallback the laptop's idle GPU has nothing to do with the job. */}
              {g.model !== "CPU" && <GpuReadings list={list} state={state} />}
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {list.map((p) => (
                <ProviderCard key={p.provider_id} p={p} state={state} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
