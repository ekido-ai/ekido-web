import { useTranslations } from "next-intl";
import type { DashboardState } from "@/lib/events/reduce";
import { providerName, recoveries, sinceStart, type RecoveryView } from "@/lib/events/derive";
import { Timeline } from "@/components/ui/timeline";
import { TruthBadge } from "@/components/ui/truth-badge";
import { StatusIcon, StatusPill } from "@/components/ui/status";
import { cx } from "@/components/ui/cx";

function secs(ms: number): string {
  const s = ms / 1000;
  return s < 10 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`;
}

function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular truncate text-lg font-semibold text-ink">{children}</div>
    </div>
  );
}


const STEP_LIMIT = 4;

function RecoveryCard({
  r,
  state,
  index,
  latest,
  collapsed,
}: {
  r: RecoveryView;
  state: DashboardState;
  index: number;
  latest: boolean;
  /** Older recoveries on mission control: header only, so the screen fits 1080p. */
  collapsed: boolean;
}) {
  const t = useTranslations("demo.timeline");
  const unknown = <span className="text-base font-normal italic text-muted">{t("unknown")}</span>;
  const pending = <span className="text-base font-normal italic text-muted">{t("notYet")}</span>;
  const maxPhase = Math.max(1, ...r.phases.map((p) => p.ms ?? 0));
  const firstOpen = r.phases.findIndex((p) => p.ms === null);
  return (
    <article
      aria-label={t("aria", { index })}
      className={cx("rounded-lg border p-4", latest ? "border-line-strong bg-surface-2" : "border-line")}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("started", { index, when: sinceStart(state, r.startedTs) })}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-ink">{r.headline}</span>
            {r.injected && <TruthBadge truth="INJECTED_FAULT" />}
          </div>
        </div>
        {r.status === "resumed" && <StatusPill tone="good">{t("resumedIn", { time: secs(r.elapsedMs) })}</StatusPill>}
        {r.status === "in_progress" && <StatusPill tone="active">{t("recovering", { time: secs(r.elapsedMs) })}</StatusPill>}
        {r.status === "aborted" && <StatusPill tone="critical">{t("gaveUp", { time: secs(r.elapsedMs) })}</StatusPill>}
      </header>

      {!collapsed && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
            <MiniStat label={t("stepsLost")}>{r.lostSteps ?? (r.status === "in_progress" ? pending : unknown)}</MiniStat>
            <MiniStat label={t("resumePoint")}>
              {r.checkpointStep !== null ? t("step", { step: r.checkpointStep }) : r.status === "in_progress" ? pending : unknown}
            </MiniStat>
            <MiniStat label={t("handedTo")}>
              {r.replacementId ? providerName(state, r.replacementId) : r.status === "in_progress" ? pending : unknown}
            </MiniStat>
            <MiniStat label={t("timeToResume")}>{r.status === "resumed" ? secs(r.elapsedMs) : pending}</MiniStat>
          </div>

          {/* Where the time went. Neutral bars: phases are ordered parts, not identities. */}
          <dl className="mt-4 space-y-1.5">
            {r.phases.map((p, i) => (
              <div key={p.label} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
                <dt className="truncate text-ink-2">{p.label}</dt>
                <div className="h-2 rounded-full bg-surface-3" aria-hidden>
                  {p.ms !== null && (
                    <div className="h-full rounded-full bg-ink-2" style={{ width: `${Math.max(2, (p.ms / maxPhase) * 100)}%` }} />
                  )}
                </div>
                <dd className="tabular flex items-center gap-1 text-right text-ink">
                  {p.ms !== null ? (
                    secs(p.ms)
                  ) : i === firstOpen && r.status === "in_progress" ? (
        <>
                      <StatusIcon tone="active" className="size-3.5" />
                      <span className="text-ink-2">{t("now")}</span>
        </>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {latest ? (
            <div className="mt-4">
              {r.entries.length > STEP_LIMIT && (
                <details className="group mb-3">
                  <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">
                    {t("earlier", { n: r.entries.length - STEP_LIMIT })}
                  </summary>
                  <div className="mt-3">
                    <Timeline entries={toEntries(r.entries.slice(0, -STEP_LIMIT))} />
                  </div>
                </details>
              )}
              <Timeline entries={toEntries(r.entries.slice(-STEP_LIMIT))} />
            </div>
          ) : (
            <details className="group mt-4">
              <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">{t("steps", { n: r.entries.length })}</summary>
              <div className="mt-3">
                <Timeline entries={toEntries(r.entries)} />
              </div>
            </details>
          )}
        </>
      )}
    </article>
  );
}

const toEntries = (list: RecoveryView["entries"]) =>
  list.map((e) => ({ id: e.id, time: e.time, tone: e.tone, title: e.title, detail: e.detail }));

/**
 * Every recovery in this job, newest first. The newest shows its numbers and last steps;
 * with `compact`, older ones shrink to a single line.
 */
export function RecoveryTimeline({ state, compact = false }: { state: DashboardState; compact?: boolean }) {
  const t = useTranslations("demo.timeline");
  const list = recoveries(state);
  if (list.length === 0) {
    return (
      <p className="text-ink-2">
        {t("empty")}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {list
        .map((r, i) => ({ r, n: i + 1 }))
        .reverse()
        .map(({ r, n }, i) => (
          <RecoveryCard key={r.attempt} r={r} state={state} index={n} latest={i === 0} collapsed={compact && i > 0} />
        ))}
    </div>
  );
}
