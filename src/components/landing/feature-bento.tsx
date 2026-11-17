import { BadgeCheck, Download, Gamepad2, Laptop, Lock, Smartphone, X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/*
 * What Ekido does, as a bento: each card has a small UI that shows the idea instead of describing it. "Encrypted
 * uploads" is marked as being built (see the landing page's honest list).
 */

function Card({ title, body, children, className }: { title: string; body: string; children?: ReactNode; className?: string }) {
  return (
    <article className={cx("artifact flex flex-col overflow-hidden p-6", className)}>
      {children && <div className="mb-6">{children}</div>}
      <h3 className="mt-auto font-serif text-xl text-ink">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
    </article>
  );
}

export function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Card
        className="md:col-span-4"
        title="Training that survives a device dropping out"
        body="Every device saves signed checkpoints. When one stops, the next picks up from the last good one, like a relay, instead of starting over."
      >
        <div className="relative grid grid-cols-3 gap-3">
          {[
            { name: "Gaming PC", note: "Dropped out", Icon: Gamepad2, s: "lost" },
            { name: "Laptop", note: "Carrying the job", Icon: Laptop, s: "on" },
            { name: "Phone", note: "Later", Icon: Smartphone, s: "later" },
          ].map(({ name, note, Icon, s }) => (
            <div key={name} className={cx("rounded-2xl border p-3.5", s === "on" ? "border-accent bg-accent-soft" : "border-line bg-surface-2", s === "lost" && "opacity-55", s === "later" && "border-dashed opacity-60")}>
              <Icon className={cx("size-5", s === "on" ? "text-accent-text" : "text-ink-2")} aria-hidden />
              <div className="mt-2 text-sm font-semibold text-ink">{name}</div>
              <div className="text-xs text-muted">{note}</div>
            </div>
          ))}
          <span aria-hidden className="pointer-events-none absolute -top-1.5 left-[calc(33.33%+0.75rem)] h-2 w-[calc(33.33%-1.5rem)] rounded-full bg-accent" />
        </div>
      </Card>

      <Card className="md:col-span-2" title="Pass your test, beat the base" body="Paid only if the model passes your own held-out examples and beats the untrained model.">
        <ul className="space-y-2 text-sm">
          {[
            ["Your test: 17 of 20", true],
            ["Better than untrained (7 of 20)", true],
          ].map(([t, ok]) => (
            <li key={t as string} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-ink">
              {ok ? <BadgeCheck className="size-4 text-success" aria-hidden /> : <X className="size-4 text-danger" aria-hidden />}
              {t as string}
            </li>
          ))}
          <li className="flex items-center justify-between rounded-xl bg-action px-3 py-2 font-semibold text-action-ink">
            Result <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">Paid</span>
          </li>
        </ul>
      </Card>

      <Card className="md:col-span-2" title="Speaks the way your customers do" body="Hindi, Hinglish and English, from 20 to 50 examples of the right answer.">
        <div className="space-y-2 text-sm">
          <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2 text-ink">Refund kab tak milega?</div>
          <div className="ml-auto w-fit rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-xs text-accent-text">refund</div>
        </div>
      </Card>

      <Card className="md:col-span-2" title="Yours to keep" body="Download the model and run it offline, or call it as an API. No per-message bill.">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3.5">
          <span className="grid size-9 place-items-center rounded-xl bg-action text-action-ink">
            <Download className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-sm text-ink">ticket-sorter.gguf</div>
            <div className="text-xs text-muted">Runs on your own machine</div>
          </div>
        </div>
      </Card>

      <Card className="md:col-span-2" title="Refunds without arguing" body="Miss the bar and the whole budget comes back. Device owners are paid only for work that passed.">
        <div className="rounded-2xl border border-dashed border-line-strong p-3.5 font-mono text-[12.5px] leading-6 text-ink-2">
          <div className="flex justify-between"><span>Budget</span><span>locked</span></div>
          <div className="flex justify-between"><span>Model passed?</span><span>no</span></div>
          <div className="flex justify-between font-semibold text-ink"><span>Refund</span><span>100%</span></div>
        </div>
      </Card>

      <Card
        className="md:col-span-6 md:grid md:grid-cols-[1fr_auto] md:items-center md:gap-8"
        title="Encrypted from your browser to the device training your model"
        body="Being built: your examples will be encrypted before they leave your browser, and deleting a job will destroy its key. Today, everything is already encrypted in storage and in transit."
      >
        <div className="flex items-center gap-2 text-sm text-ink-2 md:order-2">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <Lock className="size-5" aria-hidden />
          </span>
          <span className="rounded-full border border-line px-3 py-1 text-xs">Being built</span>
        </div>
      </Card>
    </div>
  );
}
