"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Copy, Cpu, Download, Lock, Power, ShieldCheck, Wallet } from "lucide-react";
import { config } from "@/lib/config";
import { Panel } from "@/components/ui/panel";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { ProductScene } from "@/components/brand/scenes";
import { ProviderChecklist } from "@/components/provide/checklist";
import { GPU_CLASSES, PROPOSED_FEE_BPS, clientHourly, perStepPrice, suggestedHourly } from "@/lib/pricing";

/** Measured on our RTX 3060 Laptop, full memory: experiments/results/gpu_chain_story_20261105_001829.json (12.0 to 12.3 steps/s). */
const MEASURED_3060_STEPS_PER_S = 12;
const KIT = "/ekido-provider-kit.zip";

type Os = "windows" | "unix";

const NAME_OK = /^[a-zA-Z0-9 _.-]{1,60}$/;
const PRICE_OK = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;


function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  const t = useTranslations("provide.copy");
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  return (
    <div className="group relative">
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-black/40 p-4 pr-24 font-mono text-[13px] leading-relaxed text-ink">{text}</pre>
      <button
        type="button"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("done");
            setTimeout(() => setState("idle"), 1800);
          } catch {
            setState("fail");
          }
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-3"
      >
        {state === "done" ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {t(state)}
      </button>
    </div>
  );
}

const strong = (c: React.ReactNode) => <strong className="text-ink">{c}</strong>;

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <li className="relative grid grid-cols-[2.25rem_1fr] gap-4">
      <span className={cx("grid size-9 place-items-center rounded-full border text-sm font-semibold", done ? "border-good bg-good/15 text-ink" : "border-line-strong bg-surface-2 text-ink")}>
        {done ? <Check className="size-4" aria-hidden /> : n}
      </span>
      <div className="min-w-0 pb-8">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <div className="mt-2 space-y-3 text-ink-2">{children}</div>
      </div>
    </li>
  );
}

function PriceBox({ gpu, hourly, setHourly, rate, setRate, step }: {
  gpu: (typeof GPU_CLASSES)[number];
  hourly: string;
  setHourly: (v: string) => void;
  rate: string;
  setRate: (v: string) => void;
  step: ReturnType<typeof perStepPrice>;
}) {
  const t = useTranslations("provide.price");
  const tg = useTranslations("provide.gpu");
  const client = step ? clientHourly(step.effectiveHourly) : null;
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-ink">
          {t("rate")}
          <input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 tabular" />
        </label>
        <label className="space-y-1 text-sm text-ink">
          {t("speed")}
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 tabular" />
        </label>
      </div>
      {step ? (
        <p className="mt-3 text-sm text-ink">
          {t.rich("perStep", { price: step.price, b: (c) => <span className="font-semibold tabular">{c}</span> })}
          {Math.abs(step.effectiveHourly - Number(hourly)) / Number(hourly) > 0.02 && t("rounds", { hourly: step.effectiveHourly.toFixed(3) })}.
        </p>
      ) : (
        <p className="mt-3 text-sm text-critical">{t("invalid")}</p>
      )}
      <p className="mt-1 text-xs text-ink-2">
        {t("market", { rate: gpu.marketHourly.toFixed(2), source: tg(`${gpu.id}.source`) })}
        {client !== null && <> {t("client", { fee: String(PROPOSED_FEE_BPS / 100), client: client.toFixed(3) })}</>}
      </p>
      {step && (
        <div className="mt-3 space-y-1.5" aria-label={t("barsAria")}>
          {[
            { k: t("barMarket"), v: gpu.marketHourly, cls: "bg-surface-3" },
            { k: t("barYou"), v: step.effectiveHourly, cls: "bg-accent" },
            { k: t("barClient"), v: client ?? 0, cls: "bg-trust" },
          ].map((b) => (
            <div key={b.k} className="grid grid-cols-[9.5rem_1fr_4rem] items-center gap-2 text-xs">
              <span className="text-ink-2">{b.k}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface"><span className={`block h-full rounded-full ${b.cls} transition-[width] duration-500`} style={{ width: `${Math.min(100, (b.v / Math.max(gpu.marketHourly, step.effectiveHourly, client ?? 0)) * 100)}%` }} /></span>
              <span className="text-right tabular text-ink">{b.v.toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}
      {!gpu.measuredStepsPerS && <p className="mt-1 text-xs text-ink-2">{t("unmeasured")}</p>}
    </div>
  );
}

const noSubscribe = () => () => {};
function guessOs(): Os {
  return /Mac|Linux|X11/.test(navigator.userAgent) && !/Windows/.test(navigator.userAgent) ? "unix" : "windows";
}

export default function ProvidePage() {
  const t = useTranslations("provide");
  const scenes = useTranslations("scenes");
  // The OS and origin are read after hydration (the server renders Windows and the production address); a tab
  // the person picks replaces the guess.
  const guessedOs = useSyncExternalStore(noSubscribe, guessOs, () => "windows" as Os);
  const [pickedOs, setOs] = useState<Os | null>(null);
  const os = pickedOs ?? guessedOs;
  const [name, setName] = useState("My GPU");
  const [cls, setCls] = useState(GPU_CLASSES[0].id);
  const [hourly, setHourly] = useState(String(suggestedHourly(GPU_CLASSES[0])));
  const [device, setDevice] = useState<"auto" | "cuda" | "cpu">("auto");
  const [rate, setRate] = useState(String(MEASURED_3060_STEPS_PER_S));
  const [hours, setHours] = useState(8);
  const [busy, setBusy] = useState(25);
  const [sha, setSha] = useState<string | null>(null);
  const [kitBytes, setKitBytes] = useState<number | null>(null);
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "https://ekido.duckdns.org");

  useEffect(() => {
    fetch("/ekido-provider-kit.sha256").then((r) => (r.ok ? r.text() : null)).then((t) => setSha(t?.split(/\s+/)[0] ?? null)).catch(() => {});
    fetch(KIT, { method: "HEAD" }).then((r) => setKitBytes(Number(r.headers.get("content-length")) || null)).catch(() => {});
  }, []);

  const nameOk = NAME_OK.test(name) && !!name.trim();
  const gpu = GPU_CLASSES.find((c) => c.id === cls) ?? GPU_CLASSES[0];
  const step = perStepPrice(Number(hourly), Number(rate));
  const price = step?.price ?? "";
  const priceNum = Number(price);
  const priceOk = !!step && PRICE_OK.test(price) && priceNum > 0 && priceNum <= 1;
  const pickClass = (id: string) => {
    const c = GPU_CLASSES.find((x) => x.id === id) ?? GPU_CLASSES[0];
    setCls(c.id);
    setHourly(String(suggestedHourly(c)));
    if (c.measuredStepsPerS) setRate(String(c.measuredStepsPerS));
    if (c.id === "cpu") setDevice("cpu");
  };
  const url = config.coordinatorUrl.replace(/^http/, "ws").replace(/\/$/, "");
  const secureUrl = /^wss:\/\/[a-zA-Z0-9.-]+(?::[0-9]{1,5})?(?:\/[a-zA-Z0-9/_-]*)?$/.test(url);
  const publicNet = !config.localChain && secureUrl;
  const args = `--coordinator ${url} --name "${name.replace(/"/g, "")}" --price ${price}${device === "auto" ? "" : ` --device ${device}`}`;
  const setup = os === "windows" ? "powershell -ExecutionPolicy Bypass -File .\\setup.ps1" : "./setup.sh";
  const join = os === "windows" ? `powershell -ExecutionPolicy Bypass -File .\\join.ps1 ${args}` : `./join.sh ${args}`;
  const unzip =
    os === "windows"
      ? `Invoke-WebRequest ${origin}${KIT} -OutFile ekido-provider-kit.zip\nGet-FileHash ekido-provider-kit.zip -Algorithm SHA256\nExpand-Archive ekido-provider-kit.zip .\ncd ekido-provider`
      : `curl -LO ${origin}${KIT}\nshasum -a 256 ekido-provider-kit.zip\nunzip ekido-provider-kit.zip && cd ekido-provider`;

  const est = useMemo(() => {
    if (!step) return null;
    const perHour = step.effectiveHourly;
    const perDay = perHour * hours * (busy / 100);
    return { perHour, perDay, perMonth: perDay * 30 };
  }, [step, hours, busy]);


  return (
    <div className="space-y-8">
      {/* Hero: what you get, in one breath. */}
      <section className="relative overflow-hidden panel rounded-2xl border border-line">
        <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="font-serif text-4xl text-ink sm:text-5xl">{t("hero.title")}</h1>
            <p className="mt-3 max-w-xl text-lg text-ink-2">
              {t("hero.lead")}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2 text-sm">
              {[
                [Wallet, t("hero.chips.wallet")],
                [Lock, t("hero.chips.lock")],
                [ShieldCheck, t("hero.chips.approved")],
                [Power, t("hero.chips.stop")],
              ].map(([Icon, text]) => {
                const I = Icon as typeof Wallet;
                return (
                  <li key={text as string} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-ink">
                    <I className="size-4 text-ink-2" aria-hidden />
                    {text as string}
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={KIT} download className={buttonStyles("primary", "lg")}>
                <Download className="size-5" aria-hidden /> {t("hero.download")}
              </a>
              <a href="#steps" className={buttonStyles("secondary", "lg")}>{t("hero.seeSteps")}</a>
            </div>
            <p className="mt-3 text-sm text-muted">
              {t("hero.platforms")}
              {kitBytes ? ` · ${t("hero.size", { kb: Math.round(kitBytes / 1024) })}` : ""} · {t("hero.hardware")}
            </p>
          </div>
          <div className="relative hidden h-72 place-items-center overflow-hidden lg:grid">
            <ProductScene name="devices" title="Ekido Devices" labels={scenes.raw("devices") as string[]} />
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* The four steps, in order. */}
        <Panel title={t("steps.title")} subtitle={t("steps.subtitle")}>
          <div id="steps" className="mb-5 inline-flex rounded-lg border border-line bg-surface-2 p-1 text-sm" role="tablist" aria-label={t("steps.osAria")}>
            {(["windows", "unix"] as Os[]).map((o) => (
              <button
                key={o}
                type="button"
                role="tab"
                aria-selected={os === o}
                onClick={() => setOs(o)}
                className={cx("rounded-md px-3 py-1.5 font-medium", os === o ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink")}
              >
                {t(o === "windows" ? "steps.windows" : "steps.unix")}
              </button>
            ))}
          </div>
          <ol>
            <Step n={1} title={t("steps.kit.title")}>
              <p>{t("steps.kit.body")}</p>
              <CopyBlock text={unzip} label={t("steps.kit.copy")} />
              <p className="break-all font-mono text-xs text-muted">{t("steps.kit.sha", { sha: sha ?? t("steps.kit.loading") })}</p>
            </Step>
            <Step n={2} title={t("steps.setup.title")}>
              <p>{t("steps.setup.body")}</p>
              <CopyBlock text={setup} label={t("steps.setup.copy")} />
            </Step>
            <Step n={3} title={t("steps.join.title")}>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm text-ink">
                  {t("steps.join.name")}
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2" />
                </label>
                <label className="space-y-1 text-sm text-ink">
                  {t("steps.join.hardware")}
                  <select value={cls} onChange={(e) => pickClass(e.target.value)} className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
                    {GPU_CLASSES.map((c) => <option key={c.id} value={c.id}>{t.has(`gpu.${c.id}.label`) ? t(`gpu.${c.id}.label`) : c.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-ink">
                  {t("steps.join.runOn")}
                  <select value={device} onChange={(e) => setDevice(e.target.value as typeof device)} className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
                    <option value="auto">{t("steps.join.auto")}</option>
                    <option value="cuda">{t("steps.join.cuda")}</option>
                    <option value="cpu">{t("steps.join.cpu")}</option>
                  </select>
                </label>
              </div>
              {!nameOk && <p className="text-sm text-critical">{t("steps.join.nameBad")}</p>}
              <PriceBox gpu={gpu} hourly={hourly} setHourly={setHourly} rate={rate} setRate={setRate} step={step} />
              {publicNet ? (
                nameOk && priceOk && <CopyBlock text={join} label={t("steps.join.copy")} />
              ) : (
                <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink">
                  {t.rich("steps.join.localNet", {
                    link: (c) => <a className="underline underline-offset-4" href="https://ekido.duckdns.org/provide">{c}</a>,
                  })}
                </p>
              )}
              <p className="text-sm">
                {t.rich("steps.join.key", { code: (c) => <code className="font-mono text-xs">{c}</code> })}
              </p>
            </Step>
            <Step n={4} title={t("steps.paid.title")}>
              <p>
                {t.rich("steps.paid.body", {
                  link: (c) => <Link href="/chain" className="text-ink underline underline-offset-4">{c}</Link>,
                  code: (c) => <code className="font-mono text-xs">{c}</code>,
                })}
              </p>
            </Step>
          </ol>
        </Panel>

        <div className="space-y-6">
          <ProviderChecklist />
          {/* Estimator: the number every provider wants first. */}
          <Panel title={t("earn.title")} subtitle={t("earn.subtitle")}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1 text-ink">
                {t("earn.speed")}
                <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 tabular" />
              </label>
              <label className="space-y-1 text-ink">
                {t("earn.rate")}
                <input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 tabular" />
              </label>
              <label className="col-span-2 space-y-1 text-ink">
                {t.rich("earn.hours", { hours, b: (c) => <span className="font-semibold tabular">{c}</span> })}
                <input type="range" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="block w-full accent-[var(--accent)]" />
              </label>
              <label className="col-span-2 space-y-1 text-ink">
                {t.rich("earn.busy", { busy, b: (c) => <span className="font-semibold tabular">{c}</span> })}
                <input type="range" min={5} max={100} step={5} value={busy} onChange={(e) => setBusy(Number(e.target.value))} className="block w-full accent-[var(--accent)]" />
              </label>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
              {[
                [t("earn.perHour"), est?.perHour, t("earn.unitHour")],
                [t("earn.perDay"), est?.perDay, t("earn.unitDay")],
                [t("earn.perMonth"), est?.perMonth, t("earn.unitMonth")],
              ].map(([label, value, unit]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted">{label as string}</dt>
                  <dd className="mt-0.5 text-xl font-semibold text-ink tabular">{value == null ? "–" : fmt(value as number)}</dd>
                  <dd className="text-xs text-ink-2">{unit as string}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">
              {t("earn.note", { measured: MEASURED_3060_STEPS_PER_S })}
            </p>
          </Panel>

          <Panel title={t("runs.title")}>
            <ul className="space-y-3 text-sm text-ink-2">
              <li className="flex gap-2"><Cpu className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span>{t.rich("runs.approved", { b: strong })}</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span>{t.rich("runs.data", { b: strong })}</span></li>
              <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span>{t.rich("runs.key", { b: strong })}</span></li>
              <li className="flex gap-2"><Power className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span>{t.rich("runs.stop", { b: strong })}</span></li>
            </ul>
            <p className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-2">
              {t.rich("runs.trust", { link: (c) => <Link href="/security" className="underline underline-offset-4">{c}</Link> })}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
