"use client";

import { useTranslations } from "next-intl";
import { Panel } from "@/components/ui/panel";
import type { ApiKey } from "@/lib/platform/api";
import type { CustomerJob, Quote } from "@/lib/platform/train";
import { ApiKeyList } from "./api-key-list";
import { DropZone } from "./drop-zone";
import { JobProgress } from "./job-progress";
import { QuoteCard } from "./quote-card";

/*
 * P4 (ekido-ai/ekido-internal#45): every state of the four platform components on /kit, with made-up data, for review
 * and screenshots. Nothing here calls an API. The clock is fixed, so the expiring and expired quotes always show.
 */

const NOW = Date.parse("2026-11-24T10:00:00Z");
const nothing = () => undefined;

const quote = (minutesLeft: number): Quote => ({
  quote_id: "kit",
  dataset_id: "kit",
  total_paise: 1_23_456_00,
  training_paise: 1_04_623_73,
  gst_paise: 18_832_27,
  eta_minutes: 40,
  expires_at: new Date(NOW + minutesLeft * 60_000).toISOString(),
  quality_terms: { metric: "accuracy", floor: 0.85, plain_words: "At least 85 of every 100 test examples answered correctly" },
  refund_policy: "If your model misses the bar, you get all your money back, automatically.",
  prices_provisional: true,
});

const job = (over: Partial<CustomerJob>): CustomerJob => ({
  job_id: "kit",
  state: "RUNNING",
  stage: "training",
  recipe_id: "kit",
  recipe_title: "Support ticket sorter",
  base_model: null,
  steps_done: 0,
  total_steps: 200,
  moved_devices: 0,
  quality: { metric: "accuracy", floor: 0.85, score: null, passed: null },
  model_ready: false,
  payment: { order_id: "kit", status: "HELD", amount_paise: 1_23_456_00 },
  ...over,
});

// The first item is the state's id (messages: kit.platform.jobs.<id>).
const JOBS: [string, CustomerJob][] = [
  ["queued", job({ stage: "starting", state: "QUEUED" })],
  ["training", job({ steps_done: 84 })],
  ["moved", job({ steps_done: 132, moved_devices: 1 })],
  ["checking", job({ stage: "checking", steps_done: 200 })],
  ["passed", job({ stage: "passed", steps_done: 200, quality: { metric: "accuracy", floor: 0.85, score: 0.91, passed: true }, model_ready: true })],
  [
    "refunded",
    job({ stage: "refunded", steps_done: 200, quality: { metric: "accuracy", floor: 0.85, score: 0.71, passed: false }, payment: { order_id: "kit", status: "REFUNDED", amount_paise: 1_23_456_00 } }),
  ],
  ["cancelled", job({ stage: "cancelled" })],
];

const KEYS: ApiKey[] = [
  { key_id: "a", name: "Website", mode: "live", prefix: "ek_live_9fQ2", scopes: ["models.read", "models.predict"], created_at: "2026-11-18T10:00:00Z", last_used_at: "2026-11-23T08:30:00Z" },
  { key_id: "b", name: "Staging tests", mode: "test", prefix: "ek_test_Lm3x", scopes: ["jobs"], created_at: "2026-11-22T10:00:00Z", last_used_at: null },
];

/** `id` stays the same in every language (data-kit-state); `name` is what is shown. */
function State({ id, name, children }: { id: string; name: string; children: React.ReactNode }) {
  return (
    <section data-kit-state={id} className="space-y-2">
      <p className="kicker text-[0.7rem]">{name}</p>
      {children}
    </section>
  );
}

export function PlatformKit() {
  const t = useTranslations("kit.platform");
  return (
    <>
      <Panel title={t("quote")}>
        <div data-kit="quote" className="grid gap-8 lg:grid-cols-2">
          <State id="ready" name={t("ready")}>
            <QuoteCard quote={quote(30)} onPay={nothing} onNewQuote={nothing} now={NOW} />
          </State>
          <State id="expiring-soon" name={t("expiringSoon")}>
            <QuoteCard quote={quote(3.5)} onPay={nothing} onNewQuote={nothing} now={NOW} />
          </State>
          <State id="expired" name={t("expired")}>
            <QuoteCard quote={quote(-1)} onPay={nothing} onNewQuote={nothing} now={NOW} />
          </State>
          <State id="loading-error" name={t("loadingError")}>
            <div className="space-y-4">
              <QuoteCard quote={null} onPay={nothing} onNewQuote={nothing} now={NOW} />
              <QuoteCard quote={null} error={t("quoteError")} onPay={nothing} onNewQuote={nothing} now={NOW} />
            </div>
          </State>
        </div>
      </Panel>

      <Panel title={t("timeline")}>
        <div data-kit="timeline" className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {JOBS.map(([id, j]) => (
            <State key={id} id={id} name={t(`jobs.${id}`)}>
              <JobProgress job={j} />
            </State>
          ))}
        </div>
      </Panel>

      <Panel title={t("keys")}>
        <div data-kit="keys" className="grid gap-8 lg:grid-cols-2">
          <State id="several-keys" name={t("severalKeys")}>
            <ApiKeyList keys={KEYS} manage onRevoke={nothing} />
          </State>
          <State id="read-only" name={t("readOnly")}>
            <ApiKeyList keys={KEYS} manage={false} onRevoke={nothing} />
          </State>
          <State id="empty" name={t("empty")}>
            <ApiKeyList keys={[]} manage onRevoke={nothing} />
          </State>
          <State id="loading-load-error" name={t("loadingLoadError")}>
            <div className="space-y-4">
              <ApiKeyList keys={null} manage onRevoke={nothing} />
              <ApiKeyList keys={null} manage onRevoke={nothing} error="HTTP 500 from /v1/orgs/…/api-keys" onRetry={nothing} />
            </div>
          </State>
        </div>
      </Panel>

      <Panel title={t("drop")}>
        <div data-kit="drop" className="grid gap-8 lg:grid-cols-3">
          <State id="idle" name={t("idle")}>
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={nothing} />
          </State>
          <State id="reading" name={t("reading")}>
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={nothing} reading="support-tickets.csv" />
          </State>
          <State id="chosen" name={t("chosen")}>
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={nothing} chosen={{ name: "support-tickets.csv", size: 48_312 }} />
          </State>
        </div>
      </Panel>
    </>
  );
}
