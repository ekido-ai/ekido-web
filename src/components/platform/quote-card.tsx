"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import { rupees, type Quote } from "@/lib/platform/train";

/*
 * P4 (ekido-ai/ekido-internal#45): the quote card. Price in rupees with GST shown, the time to a model, and the
 * quality bar in plain words, before anyone pays.
 * States: loading, ready, expiring soon (under 5 minutes left), expired (Pay off, "Get a new price"), error.
 */

export const EXPIRING_MS = 5 * 60_000;

export type QuoteTime = { kind: "ok" } | { kind: "expiring"; minutes: number } | { kind: "expired" };

export function quoteTime(expiresAt: string, now: number): QuoteTime {
  const left = Date.parse(expiresAt) - now;
  if (!(left > 0)) return { kind: "expired" };
  if (left < EXPIRING_MS) return { kind: "expiring", minutes: Math.max(1, Math.ceil(left / 60_000)) };
  return { kind: "ok" };
}

/** The current time, refreshed every 15 s, so an open quote notices when it runs out. */
function useNow(fixed?: number): number {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [fixed]);
  return fixed ?? now;
}

export function QuoteCard({
  quote,
  error = null,
  payState = "idle",
  busy = false,
  onPay,
  onNewQuote,
  now: fixedNow,
}: {
  quote: Quote | null;
  error?: string | null;
  payState?: "idle" | "paying" | "starting";
  busy?: boolean;
  onPay: () => void;
  onNewQuote: () => void;
  /** For tests and the design kit; otherwise the real clock. */
  now?: number;
}) {
  const t = useTranslations("train");
  const now = useNow(fixedNow);

  if (error) return <ErrorState title={t("quoteError")} detail={error} onRetry={onNewQuote} />;
  if (!quote) return <SkeletonLines lines={5} />;

  const time = payState === "idle" ? quoteTime(quote.expires_at, now) : ({ kind: "ok" } as const);
  return (
    <div className="space-y-5" data-state={time.kind}>
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <Row label={t("training")} value={rupees(quote.training_paise)} />
        <Row label={t("gst")} value={rupees(quote.gst_paise)} />
        <Row label={t("total")} value={rupees(quote.total_paise)} strong />
        <Row label={t("eta")} value={t("minutes", { n: quote.eta_minutes })} />
      </dl>
      <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
        <p className="font-semibold text-ink">{t("qualityTitle")}</p>
        <p className="mt-1 text-ink-2">{quote.quality_terms.plain_words.replace(/\.?$/, ".")}</p>
        <p className="mt-2 text-ink-2">{quote.refund_policy}</p>
        {quote.prices_provisional && <p className="mt-2 text-muted">{t("provisional")}</p>}
      </div>
      {time.kind === "expiring" && (
        <p role="status" className="rounded-lg border border-warning bg-surface-2 px-3 py-2 text-sm text-ink">
          {t("heldFor", { n: time.minutes })}
        </p>
      )}
      {time.kind === "expired" ? (
        <div className="space-y-3">
          <p role="status" className="rounded-lg border border-warning bg-surface-2 px-3 py-2 text-sm text-ink">
            {t("expired")}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonStyles("primary", "lg")} disabled={busy} onClick={onNewQuote}>
              {t("newQuote")}
            </button>
            <button type="button" className={buttonStyles("secondary", "lg")} disabled>
              {t("pay", { amount: rupees(quote.total_paise) })}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-2">{t("testMode")}</p>
          <button type="button" className={buttonStyles("primary", "lg")} disabled={busy || payState !== "idle"} onClick={onPay}>
            {payState === "starting" ? t("starting") : payState === "paying" ? t("paying") : t("pay", { amount: rupees(quote.total_paise) })}
          </button>
        </>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className={cx("tabular text-ink", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
