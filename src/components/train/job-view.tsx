"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button-styles";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import { JobProgress } from "@/components/platform/job-progress";
import { PlatformError } from "@/lib/platform/api";
import { apiBase, downloadUrl, rupees, train, type CustomerJob } from "@/lib/platform/train";

/*
 * Ticket C12: one job as its customer sees it. The Platform builds this view from an allow-list, so no device is ever
 * named, listed or counted here; "moved" says only how many times the work carried on elsewhere.
 */

const DONE = new Set(["passed", "refunded", "cancelled"]);

export function JobView({ jobId }: { jobId: string }) {
  const t = useTranslations("job");
  const [job, setJob] = useState<CustomerJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Live over a WebSocket (ticket #156); the old polling takes over whenever the socket is not delivering.
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    const show = (j: CustomerJob) => {
      setJob(j);
      setError(null);
    };
    const tick = () =>
      train
        .job(jobId)
        .then((j) => {
          if (stop) return;
          show(j);
          if (!DONE.has(j.stage)) timer = setTimeout(tick, 5000);
        })
        .catch((e) => {
          if (stop) return;
          setError(e instanceof PlatformError && e.status === 404 ? t("notFound") : (e as Error).message);
          timer = setTimeout(tick, 10000);
        });
    const connect = () => {
      let last: CustomerJob | null = null;
      try {
        socket = new WebSocket(`${new URL(apiBase(), window.location.href).href.replace(/^http/, "ws")}/jobs/${encodeURIComponent(jobId)}/live`);
      } catch {
        void tick();
        return;
      }
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type: string; job?: CustomerJob };
          if (!stop && message.type === "job" && message.job) show((last = message.job));
        } catch {
          // Not our message: ignore it. The close handler still falls back to polling.
        }
      };
      socket.onclose = () => {
        // Finished: nothing more to watch. Anything else (refused, dropped, a proxy without WebSockets): poll.
        if (!stop && !(last && DONE.has(last.stage))) void tick();
      };
    };
    if (typeof WebSocket === "undefined") void tick();
    else connect();
    return () => {
      stop = true;
      socket?.close();
      if (timer) clearTimeout(timer);
    };
  }, [jobId, t]);

  if (error && !job) return <ErrorState title={t("loadFailed")} detail={error} />;
  if (!job) return <Panel><SkeletonLines lines={5} /></Panel>;

  const curl = [
    `curl -X POST ${apiBase()}/models/${job.job_id}/predict \\`,
    `  -H "Authorization: Bearer $EKIDO_KEY" -H "Content-Type: application/json" \\`,
    `  -d '{"inputs": ["Mera refund abhi tak nahi aaya"]}'`,
  ].join("\n");

  return (
    <div className="space-y-6">
      <Panel title={job.recipe_title ?? t("title")} subtitle={t(`stageLead.${job.stage}`)}>
        <div className="space-y-5">
          <JobProgress job={job} />
          {/* A refund's payment line is already in the timeline's last step. */}
          {job.payment && job.stage !== "refunded" && <p className="text-sm text-ink-2">{t(`payment.${job.payment.status}`, { amount: rupees(job.payment.amount_paise) })}</p>}
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
