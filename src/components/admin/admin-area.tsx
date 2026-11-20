"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ConfirmButton } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, SkeletonLines } from "@/components/ui/states";
import { NetworkHealth } from "@/components/admin/network-health";
import { platform, PlatformError } from "@/lib/platform/api";
import {
  admin,
  rupees,
  type AdminAction,
  type AdminJob,
  type AdminJobDetail,
  type AdminOrder,
  type AdminProvider,
  type AdminSettlement,
  type AdminTeam,
} from "@/lib/platform/admin";

/*
 * Ticket C26: the owner's admin area. Teams, jobs (with cancel), payments (with refund), providers and the audit log, all
 * through the Platform's /v1/admin API. Only an email in ADMIN_EMAILS gets in: the API answers everyone else with 404,
 * so this page shows them the same "not found" and nothing else. Provider identities appear only here.
 */

type Gate = { kind: "loading" } | { kind: "signed-out" } | { kind: "not-admin" } | { kind: "error"; message: string } | { kind: "ready"; email: string };
const TABS = ["jobs", "payments", "teams", "providers", "network", "audit"] as const;
type Tab = (typeof TABS)[number];

const when = (iso: string | null | undefined) => (iso ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z").toLocaleString() : "–");
const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);

export function AdminArea() {
  const t = useTranslations("admin");
  const auth = useTranslations("auth");
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("jobs");

  const fetchGate = useCallback(() => {
    Promise.all([platform.me(), admin.teams()])
      .then(([me]) => setGate({ kind: "ready", email: me.email ?? "" }))
      .catch((e) => {
        if (e instanceof PlatformError && e.status === 401) setGate({ kind: "signed-out" });
        else if (e instanceof PlatformError && e.status === 404) setGate({ kind: "not-admin" });
        else setGate({ kind: "error", message: (e as Error).message });
      });
  }, []);
  useEffect(fetchGate, [fetchGate]);
  const check = () => {
    setGate({ kind: "loading" });
    fetchGate();
  };

  if (gate.kind === "loading") return <Panel><SkeletonLines lines={5} /></Panel>;
  if (gate.kind === "error") return <ErrorState title={t("loadFailed")} detail={gate.message} onRetry={check} />;
  if (gate.kind === "signed-out")
    return (
      <Panel title={t("signInTitle")} subtitle={t("signInLead")}>
        <Link href="/login" className={buttonStyles("primary", "md")}>{auth("headerSignIn")}</Link>
      </Panel>
    );
  if (gate.kind === "not-admin") return <EmptyState title={t("notFoundTitle")}>{t("notFoundLead")}</EmptyState>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-2">{t("signedInAs", { email: gate.email })}</p>
      <div role="tablist" aria-label={t("tabsLabel")} className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`admin-tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`admin-panel-${name}`}
            onClick={() => setTab(name)}
            className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", tab === name ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
          >
            {t(`tab.${name}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === "jobs" && <Jobs />}
        {tab === "payments" && <Payments />}
        {tab === "teams" && <Teams />}
        {tab === "providers" && <Providers />}
        {tab === "network" && <NetworkHealth />}
        {tab === "audit" && <Audit />}
      </div>
    </div>
  );
}

/** Loads one admin list, with a refresh button and the shared loading and error states. */
function useAdmin<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const fetchData = useCallback(() => {
    load()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  }, [load]);
  useEffect(fetchData, [fetchData]);
  const refresh = useCallback(() => {
    setBusy(true);
    fetchData();
  }, [fetchData]);
  return { data, error, busy, refresh };
}

function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  const t = useTranslations("admin");
  return (
    <Button size="sm" onClick={onClick} disabled={busy}>
      <RefreshCw className={cx("size-4", busy && "animate-spin")} aria-hidden /> {t("refresh")}
    </Button>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-line text-ink-2">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-6 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

const cell = "px-6 py-2.5 align-top";

function Jobs() {
  const t = useTranslations("admin.jobs");
  const { data, error, busy, refresh } = useAdmin(admin.jobs);
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <JobDetail jobId={open} onBack={() => { setOpen(null); refresh(); }} />;
  return (
    <Panel title={t("title")} subtitle={t("lead")} actions={<RefreshButton busy={busy} onClick={refresh} />}>
      {error && <ErrorState title={t("loadFailed")} detail={error} onRetry={refresh} />}
      {!error && !data && <SkeletonLines lines={4} />}
      {data && data.length === 0 && <EmptyState title={t("empty")} />}
      {data && data.length > 0 && (
        <Table head={[t("job"), t("state"), t("budget"), t("created")]}>
          {data.map((j: AdminJob) => (
            <tr key={j.job_id}>
              <td className={cell}>
                <button type="button" className="font-mono text-ink underline underline-offset-4" onClick={() => setOpen(j.job_id)}>{short(j.job_id)}</button>
              </td>
              <td className={cell}>{j.state.toLowerCase()}</td>
              <td className={cn(cell, "tabular")}>{j.budget_usdc ? `${Number(j.budget_usdc)} USDC` : "–"}</td>
              <td className={cell}>{when(j.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}

const CANCELLABLE = new Set(["OPEN", "ASSIGNED", "RUNNING", "RECOVERING"]);

function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const t = useTranslations("admin.jobs");
  const load = useCallback(() => admin.job(jobId), [jobId]);
  const { data, error, busy, refresh } = useAdmin<AdminJobDetail>(load);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function cancel() {
    setResult(null);
    try {
      const job = await admin.cancelJob(jobId);
      setResult({ ok: true, text: t("cancelled", { state: job.state.toLowerCase() }) });
      refresh();
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <Panel
      title={<span className="font-mono">{short(jobId)}</span>}
      subtitle={data ? t("detailLead", { state: data.job.state.toLowerCase() }) : undefined}
      actions={
        <>
          <Button size="sm" onClick={onBack}><ArrowLeft className="size-4" aria-hidden /> {t("back")}</Button>
          <RefreshButton busy={busy} onClick={refresh} />
        </>
      }
    >
      {error && <ErrorState title={t("loadFailed")} detail={error} onRetry={refresh} />}
      {!error && !data && <SkeletonLines lines={4} />}
      {data && (
        <div className="space-y-6">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Fact label={t("job")} value={jobId} mono />
            <Fact label={t("state")} value={data.job.state.toLowerCase()} />
            <Fact label={t("budget")} value={data.job.budget_usdc ? `${Number(data.job.budget_usdc)} USDC` : "–"} />
            <Fact label={t("attempt")} value={String(data.job.attempt ?? "–")} />
            <Fact label={t("deadline")} value={when(data.job.deadline)} />
            <Fact label={t("onchain")} value={data.job.onchain_id != null ? String(data.job.onchain_id) : "–"} />
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("checkpoints", { count: data.checkpoints.length })}</h3>
            {data.checkpoints.length === 0 ? (
              <p className="text-sm text-ink-2">{t("noCheckpoints")}</p>
            ) : (
              <Table head={[t("step"), t("state"), t("size"), t("signer")]}>
                {data.checkpoints.map((c) => (
                  <tr key={c.checkpoint_id}>
                    <td className={cn(cell, "tabular")}>{c.logical_step}</td>
                    <td className={cell}>{c.state.toLowerCase()}</td>
                    <td className={cn(cell, "tabular")}>{c.size_bytes != null ? `${(c.size_bytes / 1048576).toFixed(1)} MiB` : "–"}</td>
                    <td className={cn(cell, "font-mono text-xs")}>{c.signer ? short(c.signer) : "–"}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
          {CANCELLABLE.has(data.job.state) && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <ConfirmButton onConfirm={cancel} confirmLabel={t("cancelConfirm")}>{t("cancel")}</ConfirmButton>
              <span className="text-sm text-ink-2">{t("cancelLead")}</span>
            </div>
          )}
          {result && <p role="status" className={cx("text-sm", result.ok ? "text-ink" : "text-critical")}>{result.text}</p>}
        </div>
      )}
    </Panel>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className={cx("text-right text-ink [overflow-wrap:anywhere]", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function Payments() {
  const t = useTranslations("admin.payments");
  const orders = useAdmin(admin.orders);
  const settlements = useAdmin(admin.settlements);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function refund(order: AdminOrder) {
    setResult(null);
    try {
      const done = await admin.refund(order.order_id);
      setResult({ ok: true, text: t("refunded", { amount: rupees(done.amount_paise) }) });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
    orders.refresh();
  }

  return (
    <div className="space-y-6">
      <Panel title={t("ordersTitle")} subtitle={t("ordersLead")} actions={<RefreshButton busy={orders.busy} onClick={orders.refresh} />}>
        {result && <p role="status" className={cx("mb-4 text-sm", result.ok ? "text-ink" : "text-critical")}>{result.text}</p>}
        {orders.error && <ErrorState title={t("loadFailed")} detail={orders.error} onRetry={orders.refresh} />}
        {!orders.error && !orders.data && <SkeletonLines lines={3} />}
        {orders.data && orders.data.length === 0 && <EmptyState title={t("noOrders")} />}
        {orders.data && orders.data.length > 0 && (
          <Table head={[t("team"), t("amount"), t("status"), t("job"), t("created"), ""]}>
            {orders.data.map((o) => (
              <tr key={o.order_id}>
                <td className={cell}>{o.team ?? short(o.org_id)}</td>
                <td className={cn(cell, "tabular")}>{rupees(o.amount_paise)}</td>
                <td className={cell}>{o.status.toLowerCase()}</td>
                <td className={cn(cell, "font-mono text-xs")}>{o.job_id ? short(o.job_id) : "–"}</td>
                <td className={cell}>{when(o.created_at)}</td>
                <td className={cn(cell, "text-right")}>
                  {o.status === "HELD" && (
                    <ConfirmButton size="sm" onConfirm={() => refund(o)} confirmLabel={t("refundConfirm", { amount: rupees(o.amount_paise) })}>
                      {t("refund")}
                    </ConfirmButton>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Panel title={t("settlementsTitle")} subtitle={t("settlementsLead")} actions={<RefreshButton busy={settlements.busy} onClick={settlements.refresh} />}>
        {settlements.error && <ErrorState title={t("loadFailed")} detail={settlements.error} onRetry={settlements.refresh} />}
        {!settlements.error && !settlements.data && <SkeletonLines lines={3} />}
        {settlements.data && settlements.data.length === 0 && <EmptyState title={t("noSettlements")} />}
        {settlements.data && settlements.data.length > 0 && (
          <Table head={[t("job"), t("status"), t("verdict"), t("created")]}>
            {settlements.data.map((s: AdminSettlement) => (
              <tr key={s.job_id}>
                <td className={cn(cell, "font-mono text-xs")}>{short(s.job_id)}</td>
                <td className={cell}>{s.status.toLowerCase()}</td>
                <td className={cell}>{s.verdict ?? "–"}</td>
                <td className={cell}>{when(s.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Teams() {
  const t = useTranslations("admin.teams");
  const { data, error, busy, refresh } = useAdmin(admin.teams);
  return (
    <Panel title={t("title")} actions={<RefreshButton busy={busy} onClick={refresh} />}>
      {error && <ErrorState title={t("loadFailed")} detail={error} onRetry={refresh} />}
      {!error && !data && <SkeletonLines lines={3} />}
      {data && data.length === 0 && <EmptyState title={t("empty")} />}
      {data && data.length > 0 && (
        <Table head={[t("name"), t("members"), t("keys"), t("created")]}>
          {data.map((team: AdminTeam) => (
            <tr key={team.org_id}>
              <td className={cell}>{team.name}</td>
              <td className={cn(cell, "tabular")}>{team.members}</td>
              <td className={cn(cell, "tabular")}>{team.active_keys}</td>
              <td className={cell}>{when(team.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}

function Providers() {
  const t = useTranslations("admin.providers");
  const { data, error, busy, refresh } = useAdmin(admin.providers);
  return (
    <Panel title={t("title")} subtitle={t("lead")} actions={<RefreshButton busy={busy} onClick={refresh} />}>
      {error && <ErrorState title={t("loadFailed")} detail={error} onRetry={refresh} />}
      {!error && !data && <SkeletonLines lines={3} />}
      {data && data.length === 0 && <EmptyState title={t("empty")} />}
      {data && data.length > 0 && (
        <Table head={[t("name"), t("status"), t("gpu"), t("price"), t("wallet")]}>
          {data.map((p: AdminProvider) => (
            <tr key={p.provider_id}>
              <td className={cell}>{p.name}</td>
              <td className={cell}>{p.status}</td>
              <td className={cell}>{p.gpu_model ? `${p.gpu_model}${p.gpu_vram_mib ? ` · ${Math.round(p.gpu_vram_mib / 1024)} GB` : ""}` : "–"}</td>
              <td className={cn(cell, "tabular")}>{p.price_per_step ?? "–"}</td>
              <td className={cn(cell, "font-mono text-xs")}>{short(p.wallet_address)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}

function Audit() {
  const t = useTranslations("admin.audit");
  const { data, error, busy, refresh } = useAdmin(admin.audit);
  return (
    <Panel title={t("title")} subtitle={t("lead")} actions={<RefreshButton busy={busy} onClick={refresh} />}>
      {error && <ErrorState title={t("loadFailed")} detail={error} onRetry={refresh} />}
      {!error && !data && <SkeletonLines lines={3} />}
      {data && data.length === 0 && <EmptyState title={t("empty")} />}
      {data && data.length > 0 && (
        <Table head={[t("when"), t("who"), t("action"), t("target"), t("outcome")]}>
          {data.map((a: AdminAction) => (
            <tr key={a.id}>
              <td className={cell}>{when(a.at)}</td>
              <td className={cell}>{a.email}</td>
              <td className={cell}>{a.action}</td>
              <td className={cn(cell, "font-mono text-xs")}>{short(a.target)}</td>
              <td className={cell}>{a.outcome}</td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}

const cn = cx;
