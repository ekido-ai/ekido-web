"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import { PlatformError } from "@/lib/platform/api";
import { apiBase, downloadUrl, rupees, train, type CustomerJob } from "@/lib/platform/train";

/*
 * Ticket C12: one job as its customer sees it. The Platform builds this view from an allow-list, so no device is ever
 * named, listed or counted here; "moved" says only how many times the work carried on elsewhere.
 */

const STAGES = ["starting", "training", "checking", "passed"] as const;
const DONE = new Set(["passed", "refunded", "cancelled"]);

export function JobView({ jobId }: { jobId: string }) {
  const t = useTranslations("job");
  const [job, setJob] = useState<CustomerJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () =>
      train
        .job(jobId)
        .then((j) => {
          if (stop) return;
          setJob(j);
          setError(null);
          if (!DONE.has(j.stage)) timer = setTimeout(tick, 5000);
        })
        .catch((e) => {
          if (stop) return;
          setError(e instanceof PlatformError && e.status === 404 ? t("notFound") : (e as Error).message);
          timer = setTimeout(tick, 10000);
        });
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, t]);

  if (error && !job) return <ErrorState title={t("loadFailed")} detail={error} />;
  if (!job) return <Panel><SkeletonLines lines={5} /></Panel>;

  const percent = job.total_steps ? Math.round((100 * job.steps_done) / job.total_steps) : 0;
  const stageIndex = STAGES.indexOf(job.stage as (typeof STAGES)[number]);
  const curl = [
    `curl -X POST ${apiBase()}/models/${job.job_id}/predict \\`,
    `  -H "Authorization: Bearer $EKIDO_KEY" -H "Content-Type: application/json" \\`,
    `  -d '{"inputs": ["Mera refund abhi tak nahi aaya"]}'`,
  ].join("\n");

  return (
    <div className="space-y-6">
      <Panel title={job.recipe_title ?? t("title")} subtitle={t(`stageLead.${job.stage}`)}>
        <div className="space-y-5">
          {job.stage !== "refunded" && job.stage !== "cancelled" && (
            <ol className="grid grid-cols-4 gap-2 text-xs sm:text-sm">
              {STAGES.map((s, i) => (
                <li key={s} className={cx("rounded-lg px-2 py-2 text-center", i <= stageIndex ? "bg-ink text-surface" : "bg-surface-2 text-ink-2")}>{t(`stage.${s}`)}</li>
              ))}
            </ol>
          )}
          {job.total_steps ? (
            <div>
              <div className="flex justify-between text-sm text-ink-2"><span>{t("progress")}</span><span className="tabular">{t("steps", { done: job.steps_done, total: job.total_steps })}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : null}
          {job.moved_devices > 0 && <p className="text-sm text-ink">{t("moved", { n: job.moved_devices })}</p>}
          {job.quality && (
            <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
              <p className="font-semibold text-ink">{t("qualityTitle")}</p>
              <p className="mt-1 text-ink-2">
                {job.quality.score === null
                  ? t("qualityPending", { floor: Math.round(job.quality.floor * 100) })
                  : t(job.quality.passed ? "qualityPassed" : "qualityMissed", { score: Math.round(job.quality.score * 100), floor: Math.round(job.quality.floor * 100) })}
              </p>
            </div>
          )}
          {job.payment && <p className="text-sm text-ink-2">{t(`payment.${job.payment.status}`, { amount: rupees(job.payment.amount_paise) })}</p>}
        </div>
      </Panel>

      {job.model_ready && (
        <Panel title={t("modelTitle")} subtitle={t("modelLead")}>
          <div className="space-y-4">
            <a href={downloadUrl(job.job_id)} className={buttonStyles("primary", "md")}>{t("download")}</a>
            <div>
              <p className="text-sm font-semibold text-ink">{t("callTitle")}</p>
              <p className="mt-1 text-sm text-ink-2">{t("callLead")}</p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface-2 p-4 font-mono text-xs text-ink"><code>{curl}</code></pre>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
