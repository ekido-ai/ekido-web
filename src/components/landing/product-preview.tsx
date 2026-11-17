"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Boxes, FileText, Gamepad2, Laptop, MessageSquare, Paperclip, Receipt, Sparkles } from "lucide-react";
import { cx } from "@/components/ui/cx";

/*
 * The hero's product window: the Ekido app as a business will use it, with example data. Four tabs (describe, quote,
 * train, result) step forward by themselves every few seconds until the visitor picks one. The quality bar wording is
 * the quote's real wording (ekido-core quotes.py); the scores and names are examples, and the window says so.
 */

const TABS = [
  { key: "describe", label: "Describe", icon: MessageSquare },
  { key: "quote", label: "Quote", icon: Receipt },
  { key: "train", label: "Train", icon: Boxes },
  { key: "result", label: "Your model", icon: BadgeCheck },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function Describe() {
  return (
    <div className="space-y-3">
      <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] text-ink">
        Mere support tickets sort karne hain: complaint, order, refund, question. 48 examples bhej raha hoon.
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink-2">
          <Paperclip className="size-3.5" aria-hidden /> tickets.csv · 48 rows
        </div>
      </div>
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-action px-4 py-3 text-[15px] text-action-ink">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#ff9a66]">
          <Sparkles className="size-3.5" aria-hidden /> Ekido assistant
        </span>
        Got it: a Hinglish ticket sorter. I&apos;ll keep 20 of your examples aside, unseen, to test the model before you pay.
      </div>
    </div>
  );
}

export function Quote() {
  const rows: [string, string][] = [
    ["Job", "Sort support tickets (Hinglish)"],
    ["Base model", "Qwen2.5 0.5B Instruct"],
    ["Quality bar", "At least 80% of your 20 test examples answered correctly; the model must also perform better than the untrained base"],
    ["If it misses", "Full refund, automatically"],
    ["Price", "Fixed before you start, never per message"],
  ];
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 px-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="text-xs text-muted">Prices are provisional on the test network</span>
        <span className="rounded-full bg-action px-4 py-1.5 text-sm font-semibold text-action-ink">Approve and start</span>
      </div>
    </div>
  );
}

export function Train() {
  const devices = [
    { name: "Gaming PC · Pune", note: "Dropped out at step 450, checkpoint saved", Icon: Gamepad2, state: "lost" },
    { name: "Laptop · Indore", note: "Picked up from step 450", Icon: Laptop, state: "active" },
  ];
  return (
    <div className="space-y-3">
      {devices.map(({ name, note, Icon, state }) => (
        <div key={name} className={cx("flex items-center gap-3 rounded-2xl border p-3.5", state === "active" ? "border-accent bg-surface" : "border-line bg-surface-2 opacity-70")}>
          <span className={cx("grid size-9 place-items-center rounded-xl", state === "active" ? "bg-accent text-white" : "bg-surface-3 text-ink-2")}>
            <Icon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{name}</div>
            <div className="text-xs text-muted">{note}</div>
          </div>
          {state === "active" && <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />}
        </div>
      ))}
      <div>
        <div className="flex justify-between text-xs text-muted">
          <span>Step 780 of 1,000</span>
          <span>78%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full w-[78%] rounded-full bg-accent" />
        </div>
      </div>
    </div>
  );
}

export function Result() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
        <BadgeCheck className="size-6 shrink-0 text-success" aria-hidden />
        <div>
          <div className="font-semibold text-ink">Passed: 17 of 20 test examples correct</div>
          <div className="text-sm text-ink-2">The untrained model got 7 of 20. Both conditions met.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <FileText className="size-4 text-ink-2" aria-hidden />
          <div className="mt-2 font-semibold text-ink">Download</div>
          <div className="font-mono text-xs text-muted">ticket-sorter.gguf</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <Sparkles className="size-4 text-ink-2" aria-hidden />
          <div className="mt-2 font-semibold text-ink">Or call it over an API</div>
          <div className="font-mono text-xs text-muted">with an ek_live_… key</div>
        </div>
      </div>
    </div>
  );
}

const PANELS: Record<Tab, () => React.ReactElement> = { describe: Describe, quote: Quote, train: Train, result: Result };

export function ProductPreview() {
  const [tab, setTab] = useState<Tab>("describe");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTab((cur) => TABS[(TABS.findIndex((x) => x.key === cur) + 1) % TABS.length].key), 4200);
    return () => clearInterval(t);
  }, [auto]);

  const Panel = PANELS[tab];
  return (
    <figure className="overflow-hidden rounded-[1.75rem] border border-line bg-bg shadow-[0_1px_0_rgba(31,42,51,0.04),0_40px_80px_-40px_rgba(31,42,51,0.55)]">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <span className="size-3 rounded-full bg-surface-3" />
        <span className="size-3 rounded-full bg-surface-3" />
        <span className="size-3 rounded-full bg-accent" />
        <span className="ml-3 truncate font-mono text-xs text-muted">ekido · new job</span>
        <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted">Preview, example data</span>
      </div>
      <div className="grid sm:grid-cols-[11rem_1fr]">
        <nav aria-label="Product preview steps" className="flex gap-1 overflow-x-auto border-b border-line bg-surface p-2 sm:flex-col sm:border-b-0 sm:border-r">
          {TABS.map(({ key, label, icon: Icon }, i) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setAuto(false);
                setTab(key);
              }}
              aria-pressed={tab === key}
              className={cx(
                "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                tab === key ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <span className={cx("grid size-5 place-items-center rounded-full text-[11px] font-bold", tab === key ? "bg-accent text-white" : "bg-surface-3 text-ink-2")}>{i + 1}</span>
              <Icon className="hidden size-4 sm:block" aria-hidden />
              {label}
              {auto && tab === key && (
                <span aria-hidden className="preview-progress absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-accent" />
              )}
            </button>
          ))}
        </nav>
        <div className="min-h-[19rem] p-4 sm:p-6" key={tab}>
          <div className="anim-fade">
            <Panel />
          </div>
        </div>
      </div>
    </figure>
  );
}
