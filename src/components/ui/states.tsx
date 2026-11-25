import { ExternalLink, Inbox, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusIcon } from "./status";
import { Button } from "./button";

/** Every state is designed: empty, loading, waiting on chain, offline, error. */

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <Inbox className="size-6 text-muted" aria-hidden />
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="max-w-md text-sm text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Loading always says what it is waiting for. No bare spinner. */
export function LoadingState({ waitingFor }: { waitingFor: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3" role="status">
      <StatusIcon tone="active" />
      <span className="text-sm text-ink">Waiting for {waitingFor}…</span>
    </div>
  );
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="loading-shimmer h-3 rounded"
          style={{ width: `${90 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-critical bg-surface-2 px-4 py-3" role="alert">
      <StatusIcon tone="critical" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        {detail && <p className="mt-0.5 break-words text-sm text-ink-2">{detail}</p>}
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function OfflineState({ since }: { since?: string }) {
  const t = useTranslations("shell.states");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning bg-surface-2 px-4 py-3" role="status">
      <WifiOff className="size-4 text-warning" aria-hidden />
      <span className="text-sm text-ink">
        {since ? t("offlineSince", { since }) : t("offline")}
      </span>
    </div>
  );
}

/** A chain transaction never shows as a stuck spinner: status, hash and link are always visible. */
export function TxStatus({
  label,
  status,
  hash,
  href,
}: {
  label: string;
  status: "pending" | "confirmed" | "failed";
  hash: string;
  href: string | null;
}) {
  const tone = status === "confirmed" ? "good" : status === "failed" ? "critical" : "active";
  const t = useTranslations("shell.states");
  const word = t(status === "confirmed" ? "confirmed" : status === "failed" ? "failed" : "pending");
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <StatusIcon tone={tone} />
      <span className="font-medium text-ink">{label}</span>
      <span className="text-ink-2">{word}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
        >
          {short}
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">{t("opensExplorer")}</span>
        </a>
      ) : (
        <span className="font-mono text-ink-2">{short}</span>
      )}
    </div>
  );
}
