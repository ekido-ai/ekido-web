"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FundStep } from "@/components/jobs/fund-step";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useTypedBeforeHydration } from "@/components/ui/typed-before-hydration";
import { config } from "@/lib/config";
import { useSourceControl } from "@/lib/events/source-context";
import { checkRegisteredJob, prepareSignedRequest, type PreparedSignedRequest } from "@/lib/jobs/signed-request";
import { readJobFile } from "@/lib/jobs/upload";
import { loadToken, saveToken } from "@/lib/jobs/token-store";
import { post } from "@/lib/live/api";

const noSubscribe = () => () => {};

export default function NewJobPage() {
  const t = useTranslations("newJob");
  const router = useRouter();
  const { followJob } = useSourceControl();
  const [text, setText] = useState("");
  // JSON pasted before the script loaded would leave "Verify signed terms" disabled (ekido-ai/ekido-core#125).
  const textField = useRef<HTMLTextAreaElement>(null);
  useTypedBeforeHydration(textField, setText);
  // The token is kept for this tab only, so it is pasted once per visit. It is read after hydration, and what the
  // person types replaces it.
  const savedToken = useSyncExternalStore(noSubscribe, loadToken, () => "");
  const [typedToken, setToken] = useState<string | null>(null);
  const token = typedToken ?? savedToken;
  const [prepared, setPrepared] = useState<PreparedSignedRequest | null>(null);
  const [registered, setRegistered] = useState(false);
  const [funded, setFunded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Off by default: training starts when the person presses Start training. Ticking the box starts it by itself
  // as soon as the escrow is verified.
  const [autoStart, setAutoStart] = useState(false);
  const started = useRef(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function register(request: PreparedSignedRequest) {
    const response = await fetch(config.coordinatorUrl + "/healthz", {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error(t("healthFailed"));
    const health = await response.json();
    if (health.signed_jobs !== true || health.chain_id !== config.chainId ||
        typeof health.escrow_address !== "string" ||
        health.escrow_address.toLowerCase() !== config.escrowAddress?.toLowerCase()) {
      throw new Error(t("notConfigured"));
    }
    const result = await post("/jobs", request.body, "signed-" + request.body.job_id, { token: token.trim() });
    if (!result.ok) throw new Error(result.error);
    checkRegisteredJob(request, result.data);
    saveToken(token.trim());
    setRegistered(true);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    await run(async () => {
      const contents = await readJobFile(file);
      setText(contents);
      const request = await prepareSignedRequest(contents, config.chainId, config.escrowAddress);
      setPrepared(request);
      started.current = false;
      // With the token already known in this tab, uploading registers the job too.
      if (token.trim()) await register(request);
    });
  }

  useEffect(() => {
    if (!autoStart || !funded || !prepared || started.current) return;
    started.current = true;
    void run(() => start(prepared));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, funded, prepared]);

  async function start(request: PreparedSignedRequest) {
    const id = request.body.job_id;
    const result = await post<{ job_id: string; state: string }>(
      "/jobs/" + encodeURIComponent(id) + "/activate",
      {},
      "activate-" + id,
      { token: token.trim(), timeoutMs: 180000 },
    );
    if (!result.ok) throw new Error(result.error);
    if (result.data.job_id !== id || !result.data.state) throw new Error(t("unexpected"));
    if (result.data.state === "OPEN") throw new Error(t("providerNotReady"));
    followJob(id);
    router.push("/dashboard?source=live&job=" + encodeURIComponent(id));
  }

  if (!config.signedJobs || config.chainId !== 84532 || !config.escrowAddress || !config.coordinatorUrl.startsWith("https://")) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} kicker={t("kicker")}>{t("unavailableLead")}</PageHeader>
        <Panel title={t("unavailableTitle")}>
          <p className="text-sm text-ink-2">{t("unavailable")}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} kicker={t("kicker")}>{t("lead")}</PageHeader>
      {!registered && (
        <Panel title={t("importTitle")}>
          <div className="space-y-4">
            <p className="text-sm text-ink-2">
              {t("importLead")}
            </p>
            <label className="block text-sm text-ink">
              {t("upload")}
              <input type="file" accept="application/json,.json" disabled={busy}
                className="mt-2 block w-full rounded-md border border-line bg-surface-2 p-2 text-sm"
                onChange={(event) => { void onFile(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            <p className="text-xs text-ink-2">{t("checkedHere")}</p>
            <label className="block text-sm text-ink">
              {t("json")}
              <textarea ref={textField} className="mt-2 block min-h-36 w-full rounded-md border border-line bg-surface-2 p-3 font-mono"
                value={text} maxLength={250000} disabled={busy} spellCheck={false}
                onChange={(event) => { setText(event.target.value); setPrepared(null); setError(""); }} />
            </label>
            <Button disabled={busy || !text.trim()} onClick={() => void run(async () => {
              setPrepared(await prepareSignedRequest(text, config.chainId, config.escrowAddress));
            })}>{t("verify")}</Button>
            {prepared && (
              <div className="space-y-3 rounded-md border border-line p-4">
                <p className="break-all text-sm text-ink">{t("summary", { id: prepared.body.job_id, budget: String(prepared.body.budget_usdc), seconds: String(prepared.body.deadline_seconds) })}</p>
                <p className="break-all text-sm text-ink-2">{t("client", { address: prepared.body.client_address })}</p>
                <label className="block text-sm text-ink">
                  {t("token")}
                  <input type="password" autoComplete="off" className="mt-2 block w-full rounded-md border border-line bg-surface-2 p-2"
                    value={token} disabled={busy} onChange={(event) => setToken(event.target.value)} />
                </label>
                <p className="text-xs text-ink-2">{t("tokenNote")}</p>
                <Button disabled={busy || !token.trim()} onClick={() => void run(() => register(prepared))}>{t("register")}</Button>
              </div>
            )}
          </div>
        </Panel>
      )}
      {registered && prepared && (
        <Panel title={t("fundTitle")}>
          <FundStep prepared={prepared} onFunded={() => setFunded(true)} />
        </Panel>
      )}
      {funded && prepared && (
        <Panel title={t("startTitle")}>
          <label className="mb-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} />
            {t("autoStart")}
          </label>
          <Button disabled={busy} onClick={() => void run(() => start(prepared))}>
            {t(busy ? "starting" : "start")}
          </Button>
        </Panel>
      )}
      {error && <p role="alert" className="rounded-md border border-warning bg-surface p-4 text-sm text-ink">{error}</p>}
      {busy && !funded && <p role="status" className="text-sm text-ink-2">{t("checking")}</p>}
    </div>
  );
}
