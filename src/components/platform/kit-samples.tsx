"use client";

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

const JOBS: [string, CustomerJob][] = [
  ["Queued", job({ stage: "starting", state: "QUEUED" })],
  ["Training", job({ steps_done: 84 })],
  ["A device moved", job({ steps_done: 132, moved_devices: 1 })],
  ["Checking quality", job({ stage: "checking", steps_done: 200 })],
  ["Passed", job({ stage: "passed", steps_done: 200, quality: { metric: "accuracy", floor: 0.85, score: 0.91, passed: true }, model_ready: true })],
  [
    "Missed, refunded",
    job({ stage: "refunded", steps_done: 200, quality: { metric: "accuracy", floor: 0.85, score: 0.71, passed: false }, payment: { order_id: "kit", status: "REFUNDED", amount_paise: 1_23_456_00 } }),
  ],
  ["Cancelled", job({ stage: "cancelled" })],
];

const KEYS: ApiKey[] = [
  { key_id: "a", name: "Website", mode: "live", prefix: "ek_live_9fQ2", scopes: ["models.read", "models.predict"], created_at: "2026-11-18T10:00:00Z", last_used_at: "2026-11-23T08:30:00Z" },
  { key_id: "b", name: "Staging tests", mode: "test", prefix: "ek_test_Lm3x", scopes: ["jobs"], created_at: "2026-11-22T10:00:00Z", last_used_at: null },
];

function State({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section data-kit-state={name} className="space-y-2">
      <p className="kicker text-[0.7rem]">{name}</p>
      {children}
    </section>
  );
}

export function PlatformKit() {
  return (
    <>
      <Panel title="Quote card">
        <div data-kit="quote" className="grid gap-8 lg:grid-cols-2">
          <State name="Ready">
            <QuoteCard quote={quote(30)} onPay={nothing} onNewQuote={nothing} now={NOW} />
          </State>
          <State name="Expiring soon">
            <QuoteCard quote={quote(3.5)} onPay={nothing} onNewQuote={nothing} now={NOW} />
          </State>
          <State name="Expired">
            <QuoteCard quote={quote(-1)} onPay={nothing} onNewQuote={nothing} now={NOW} />
          </State>
          <State name="Loading and error">
            <div className="space-y-4">
              <QuoteCard quote={null} onPay={nothing} onNewQuote={nothing} now={NOW} />
              <QuoteCard quote={null} error="The examples were removed from your team. Upload them again." onPay={nothing} onNewQuote={nothing} now={NOW} />
            </div>
          </State>
        </div>
      </Panel>

      <Panel title="Progress timeline">
        <div data-kit="timeline" className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {JOBS.map(([name, j]) => (
            <State key={name} name={name}>
              <JobProgress job={j} />
            </State>
          ))}
        </div>
      </Panel>

      <Panel title="API-key list">
        <div data-kit="keys" className="grid gap-8 lg:grid-cols-2">
          <State name="Several keys (owner)">
            <ApiKeyList keys={KEYS} manage onRevoke={nothing} />
          </State>
          <State name="Read-only (member)">
            <ApiKeyList keys={KEYS} manage={false} onRevoke={nothing} />
          </State>
          <State name="Empty">
            <ApiKeyList keys={[]} manage onRevoke={nothing} />
          </State>
          <State name="Loading and load error">
            <div className="space-y-4">
              <ApiKeyList keys={null} manage onRevoke={nothing} />
              <ApiKeyList keys={null} manage onRevoke={nothing} error="HTTP 500 from /v1/orgs/…/api-keys" onRetry={nothing} />
            </div>
          </State>
        </div>
      </Panel>

      <Panel title="Upload drop zone">
        <div data-kit="drop" className="grid gap-8 lg:grid-cols-3">
          <State name="Idle (drag a file over it, or choose a wrong one, to see the other states)">
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={nothing} />
          </State>
          <State name="Reading">
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={nothing} reading="support-tickets.csv" />
          </State>
          <State name="Chosen">
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={nothing} chosen={{ name: "support-tickets.csv", size: 48_312 }} />
          </State>
        </div>
      </Panel>
    </>
  );
}
