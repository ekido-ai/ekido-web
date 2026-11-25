"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/ui/button";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import type { ApiKey } from "@/lib/platform/api";

/*
 * P4 (ekido-ai/ekido-internal#45): a team's API keys. Only the prefix is shown, never the secret, which is shown once
 * when a key is made (team-settings.tsx). Revoking takes two presses.
 * States: loading, load error, empty, several keys ("Last used" or "Never used"), read-only for a member, revoke armed.
 */

export function ApiKeyList({
  keys,
  manage,
  onRevoke,
  error = null,
  onRetry,
}: {
  keys: ApiKey[] | null;
  /** Owners and admins revoke; members only see the list. */
  manage: boolean;
  onRevoke: (key: ApiKey) => void;
  error?: string | null;
  onRetry?: () => void;
}) {
  const t = useTranslations("settings");
  const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  if (error) return <ErrorState title={t("loadFailed")} detail={error} onRetry={onRetry} />;
  if (!keys) return <SkeletonLines lines={3} />;
  if (keys.length === 0) return <p className="text-sm text-muted">{t("noKeys")}</p>;

  return (
    <ul aria-label={t("keysLabel")} className="divide-y divide-line rounded-lg border border-line">
      {keys.map((k) => (
        <li key={k.key_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0 space-y-0.5">
            <span className="block font-semibold text-ink">
              {k.name} <span className="rounded border border-line px-1.5 py-0.5 text-xs font-medium text-ink-2">{t(`modes.${k.mode}`)}</span>
            </span>
            <span className="block font-mono text-xs text-muted">{k.prefix}…</span>
            <span className="block text-xs text-ink-2">{k.scopes.map((s) => t(`scopeNames.${s}`)).join(" · ")}</span>
            <span className="block text-xs text-muted">
              {t("created", { date: date(k.created_at) })} · {k.last_used_at ? t("lastUsed", { date: date(k.last_used_at) }) : t("neverUsed")}
            </span>
          </span>
          {manage && (
            <ConfirmButton size="sm" variant="danger" confirmLabel={t("confirmRevoke")} onConfirm={() => onRevoke(k)}>
              {t("revoke")}
            </ConfirmButton>
          )}
        </li>
      ))}
    </ul>
  );
}
