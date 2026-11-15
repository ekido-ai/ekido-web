"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Cpu, Download, Lock, Power, ShieldCheck, Wallet } from "lucide-react";
import { config } from "@/lib/config";
import { countConnected } from "@/lib/live/providers";
import { ProviderRoster } from "@/components/network/provider-roster";
import { useProviders } from "@/lib/live/use-providers";
import { Panel } from "@/components/ui/panel";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { ChipScene } from "@/components/gpu/chip-art";
import { ProviderChecklist } from "@/components/provide/checklist";
import { GPU_CLASSES, PROPOSED_FEE_BPS, clientHourly, perStepPrice, suggestedHourly } from "@/lib/pricing";

/** Measured on our RTX 3060 Laptop, full memory: experiments/results/gpu_chain_story_20261105_001829.json (12.0 to 12.3 steps/s). */
const MEASURED_3060_STEPS_PER_S = 12;
const KIT = "/ekido-provider-kit.zip";

type Os = "windows" | "unix";
type Provider = { status: string; price_per_step?: string; name?: string; provider_id?: string; kind?: string; capacity_mib?: number | null };

const NAME_OK = /^[a-zA-Z0-9 _.-]{1,60}$/;
const PRICE_OK = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function CopyBlock({ text, label }: { text: string; label: string }) {
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
        {state === "done" ? "Copied" : state === "fail" ? "Select and copy" : "Copy"}
      </button>
    </div>
  );
}

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
  const client = step ? clientHourly(step.effectiveHourly) : null;
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-ink">
          Your rate, USDC per hour of accepted work
          <input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 tabular" />
        </label>
        <label className="space-y-1 text-sm text-ink">
          Your speed, steps per second
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 tabular" />
        </label>
      </div>
      {step ? (
        <p className="mt-3 text-sm text-ink">
          That&apos;s <span className="font-semibold tabular">{step.price} USDC</span> per accepted step
          {Math.abs(step.effectiveHourly - Number(hourly)) / Number(hourly) > 0.02 && <> (rounds to {step.effectiveHourly.toFixed(3)} an hour)</>}.
        </p>
      ) : (
        <p className="mt-3 text-sm text-critical">Enter a rate and a speed above zero.</p>
      )}
      <p className="mt-1 text-xs text-ink-2">
        Typical market rate for this class: about {gpu.marketHourly.toFixed(2)} an hour ({gpu.source}). We suggest about 15% under it.
        {client !== null && <> With the planned {PROPOSED_FEE_BPS / 100}% fee a client would pay {client.toFixed(3)} an hour, and nothing for failed time.</>}
      </p>
      {step && (
        <div className="mt-3 space-y-1.5" aria-label="Your rate next to the market">
          {[
            { k: "Typical market rate", v: gpu.marketHourly, cls: "bg-surface-3" },
            { k: "You earn", v: step.effectiveHourly, cls: "bg-accent" },
            { k: "Client pays, fee included", v: client ?? 0, cls: "bg-trust" },
          ].map((b) => (
            <div key={b.k} className="grid grid-cols-[9.5rem_1fr_4rem] items-center gap-2 text-xs">
              <span className="text-ink-2">{b.k}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface"><span className={`block h-full rounded-full ${b.cls} transition-[width] duration-500`} style={{ width: `${Math.min(100, (b.v / Math.max(gpu.marketHourly, step.effectiveHourly, client ?? 0)) * 100)}%` }} /></span>
              <span className="text-right tabular text-ink">{b.v.toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}
      {!gpu.measuredStepsPerS && <p className="mt-1 text-xs text-ink-2">We haven&apos;t measured this class ourselves, so put in your own speed. The figure shown is our RTX 3060&apos;s.</p>}
    </div>
  );
}

export default function ProvidePage() {
  const [os, setOs] = useState<Os>("windows");
  const [name, setName] = useState("My GPU");
  const [cls, setCls] = useState(GPU_CLASSES[0].id);
  const [hourly, setHourly] = useState(String(suggestedHourly(GPU_CLASSES[0])));
  const [device, setDevice] = useState<"auto" | "cuda" | "cpu">("auto");
  const [rate, setRate] = useState(String(MEASURED_3060_STEPS_PER_S));
  const [hours, setHours] = useState(8);
  const [busy, setBusy] = useState(25);
  // The network list is kept fresh: it used to be read once, so a provider joining or leaving never showed.
  const network = useProviders<Provider>();
  const [sha, setSha] = useState<string | null>(null);
  const [kitBytes, setKitBytes] = useState<number | null>(null);
  const [origin, setOrigin] = useState("https://gpuchain.duckdns.org");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (/Mac|Linux|X11/.test(navigator.userAgent) && !/Windows/.test(navigator.userAgent)) setOs("unix");
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

  const rows = Array.isArray(network) ? network : [];
  const online = countConnected(rows);
  const prices = rows.map((p) => Number(p.price_per_step)).filter((n) => n > 0);
  const mid = median(prices);

  return (
    <div className="space-y-8">
      {/* Hero: what you get, in one breath. */}
      <section className="relative overflow-hidden panel rounded-2xl border border-line">
        <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="font-serif text-4xl text-ink sm:text-5xl">Rent out your GPU</h1>
            <p className="mt-3 max-w-xl text-lg text-ink-2">
              Earn for every training step the network accepts. You set the price, your key never leaves your machine, and you can stop whenever you like.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2 text-sm">
              {[
                [Wallet, "Paid in USDC, no token"],
                [Lock, "Money held in escrow"],
                [ShieldCheck, "Approved workloads only"],
                [Power, "Stop with Ctrl+C"],
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
                <Download className="size-5" aria-hidden /> Download the provider kit
              </a>
              <a href="#steps" className={buttonStyles("secondary", "lg")}>See the 4 steps</a>
            </div>
            <p className="mt-3 text-sm text-muted">
              Windows, macOS or Linux{kitBytes ? ` · ${Math.round(kitBytes / 1024)} KB` : ""} · works with an NVIDIA GPU or just a CPU
            </p>
          </div>
          <div className="relative hidden h-72 place-items-center overflow-hidden lg:grid">
            <ChipScene phase="training" util={0.8} vram={0.5} size={190} fieldWidth={520} fieldHeight={320} perSide={7} label="YOUR GPU" />
          </div>
        </div>
      </section>

      {/* The network right now: social proof and price guidance. */}
      <section aria-label="The network now" className="grid gap-4 sm:grid-cols-3">
        {[
          ["Providers connected", network === null ? "…" : network === "down" ? "unreachable" : String(online), network === "down" ? "The coordinator didn't answer from here" : `${rows.length} registered in total`],
          ["Typical price", mid === null ? "–" : `${fmt(mid, 4)}`, mid === null ? "No prices published yet" : "Median USDC per step on this network"],
          ["Range", prices.length ? `${fmt(Math.min(...prices), 4)} to ${fmt(Math.max(...prices), 4)}` : "–", "Cheaper providers get picked first when they can finish in time"],
        ].map(([label, value, note]) => (
          <div key={label} className="panel rounded-2xl border border-line p-4">
            <div className="text-sm text-ink-2">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-ink tabular">{value}</div>
            <div className="mt-0.5 text-xs text-muted">{note}</div>
          </div>
        ))}
      </section>

      <section aria-label="Providers on the network" className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">Who is connected</h2>
        <ProviderRoster rows={network} />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* The four steps, in order. */}
        <Panel title="Join in four steps" subtitle="Each step shows the exact command for your system">
          <div id="steps" className="mb-5 inline-flex rounded-lg border border-line bg-surface-2 p-1 text-sm" role="tablist" aria-label="Your system">
            {(["windows", "unix"] as Os[]).map((o) => (
              <button
                key={o}
                type="button"
                role="tab"
                aria-selected={os === o}
                onClick={() => setOs(o)}
                className={cx("rounded-md px-3 py-1.5 font-medium", os === o ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink")}
              >
                {o === "windows" ? "Windows" : "macOS or Linux"}
              </button>
            ))}
          </div>
          <ol>
            <Step n={1} title="Download and check the kit">
              <p>It holds the agent&apos;s Python source plus setup and join scripts. Compare the hash with the one below before you run anything.</p>
              <CopyBlock text={unzip} label="Copy download commands" />
              <p className="break-all font-mono text-xs text-muted">SHA-256 {sha ?? "loading…"}</p>
            </Step>
            <Step n={2} title="Set it up, once">
              <p>
                It makes a private Python environment in the folder, installs PyTorch for your GPU (or the CPU), and downloads the model and dataset. Needs Python 3.11 or newer,
                about 5 GB of disk, and for a GPU an NVIDIA driver.
              </p>
              <CopyBlock text={setup} label="Copy setup command" />
            </Step>
            <Step n={3} title="Join with your name and price">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm text-ink">
                  Name others see
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2" />
                </label>
                <label className="space-y-1 text-sm text-ink">
                  Your hardware
                  <select value={cls} onChange={(e) => pickClass(e.target.value)} className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
                    {GPU_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-ink">
                  Run on
                  <select value={device} onChange={(e) => setDevice(e.target.value as typeof device)} className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
                    <option value="auto">Best available</option>
                    <option value="cuda">NVIDIA GPU</option>
                    <option value="cpu">CPU only</option>
                  </select>
                </label>
              </div>
              {!nameOk && <p className="text-sm text-critical">Use letters, numbers, spaces, dots, hyphens or underscores.</p>}
              <PriceBox gpu={gpu} hourly={hourly} setHourly={setHourly} rate={rate} setRate={setRate} step={step} />
              {mid !== null && priceOk && priceNum > mid * 1.5 && <p className="text-sm text-warning">That&apos;s well above the typical price here, so you may get picked less often.</p>}
              {publicNet ? (
                nameOk && priceOk && <CopyBlock text={join} label="Copy join command" />
              ) : (
                <p className="rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink">
                  This copy of the site runs the local demo network. To join the public test network, open this page on{" "}
                  <a className="underline underline-offset-4" href="https://gpuchain.duckdns.org/provide">gpuchain.duckdns.org</a>.
                </p>
              )}
              <p className="text-sm">
                The first run creates your key in <code className="font-mono text-xs">~/.gpuchain/provider.key</code> and prints only your address. Never share that file.
              </p>
            </Step>
            <Step n={4} title="Get paid">
              <p>
                When a job you worked on settles, your share waits in the escrow under your address. Paste the address into{" "}
                <Link href="/chain" className="text-ink underline underline-offset-4">Check any wallet</Link> to see it, then call <code className="font-mono text-xs">withdraw()</code> from that wallet whenever you like.
              </p>
            </Step>
          </ol>
        </Panel>

        <div className="space-y-6">
          <ProviderChecklist />
          {/* Estimator: the number every provider wants first. */}
          <Panel title="What could you earn?" subtitle="An estimate from your price and speed, not a promise">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1 text-ink">
                Steps per second
                <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 tabular" />
              </label>
              <label className="space-y-1 text-ink">
                Your rate, USDC an hour
                <input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" className="block w-full rounded-lg border border-line-strong bg-surface-2 px-3 py-2 tabular" />
              </label>
              <label className="col-span-2 space-y-1 text-ink">
                Hours a day you&apos;re connected: <span className="font-semibold tabular">{hours}</span>
                <input type="range" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="block w-full accent-[var(--accent)]" />
              </label>
              <label className="col-span-2 space-y-1 text-ink">
                Share of that time with a job: <span className="font-semibold tabular">{busy}%</span>
                <input type="range" min={5} max={100} step={5} value={busy} onChange={(e) => setBusy(Number(e.target.value))} className="block w-full accent-[var(--accent)]" />
              </label>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
              {[
                ["While training", est?.perHour, "/ hour"],
                ["Per day", est?.perDay, "/ day"],
                ["Per month", est?.perMonth, "/ 30 days"],
              ].map(([label, value, unit]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted">{label as string}</dt>
                  <dd className="mt-0.5 text-xl font-semibold text-ink tabular">{value == null ? "–" : fmt(value as number)}</dd>
                  <dd className="text-xs text-ink-2">USDC {unit as string}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">
              Rate × hours × share busy, after rounding your rate to a whole micro-USDC per step. {MEASURED_3060_STEPS_PER_S} steps/s is what our RTX 3060 Laptop measured on this
              workload; yours will differ. How busy you are depends on demand, which is small on a test network. Only accepted steps pay, and this network uses test USDC with no value.
            </p>
          </Panel>

          <Panel title="What runs on your machine">
            <ul className="space-y-3 text-sm text-ink-2">
              <li className="flex gap-2"><Cpu className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span><strong className="text-ink">Only approved training jobs.</strong> Today that&apos;s fine-tuning a small text model on a public dataset. No one can send you arbitrary code.</span></li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span><strong className="text-ink">Checkpoints are data, never code.</strong> They&apos;re safetensors and JSON, checked for size, shape and bad values before loading.</span></li>
              <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span><strong className="text-ink">Your key stays put.</strong> The site never asks for it. The agent signs your work with it locally.</span></li>
              <li className="flex gap-2"><Power className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /><span><strong className="text-ink">Stop any time.</strong> The job moves on from its last checkpoint, and the accepted steps you did are still yours.</span></li>
            </ul>
            <p className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-2">
              The kit runs jobs as normal processes under your user, so only join a coordinator you trust. It&apos;s a prototype on a test network and is unaudited. More on the{" "}
              <Link href="/security" className="underline underline-offset-4">security page</Link>.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
