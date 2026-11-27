"use client";

import { useState } from "react";
import { Mail, RotateCcw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, ConfirmButton } from "@/components/ui/button";
import type { Member } from "@/lib/platform/api";

/**
 * The team's members. Someone invited who hasn't opened the invite yet shows as Invited, with when it went and,
 * for owners and admins, Resend. Older Platform versions don't send `status`, so those rows show as members.
 */
export function MemberList({ members, myUserId, manage, onRemove, onResend }: {
  members: Member[];
  myUserId: string;
  manage: boolean;
  onRemove: (member: Member) => void;
  onResend: (member: Member) => Promise<unknown>;
}) {
  const t = useTranslations("settings");
  const format = useFormatter();
  const [resending, setResending] = useState<string | null>(null);
  return (
    <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
      {members.map((m) => {
        const invited = m.status === "invited";
        return (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm" data-status={invited ? "invited" : "joined"}>
            <span className="min-w-0">
              <span className="text-ink [overflow-wrap:anywhere]">{m.email ?? m.user_id}</span>{" "}
              {m.user_id === myUserId && <span className="text-muted">({t("you")})</span>}
              {invited && (
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 font-medium text-ink-2">
                    <Mail className="size-3" aria-hidden /> {t("invitedBadge")}
                  </span>
                  {m.invited_at && <span>{t("invitedSince", { when: format.relativeTime(new Date(m.invited_at)) })}</span>}
                </span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-ink-2">{t(`roles.${m.role}`)}</span>
              {manage && invited && m.email && (
                <Button
                  size="sm"
                  disabled={resending === m.user_id}
                  onClick={() => {
                    setResending(m.user_id);
                    onResend(m).finally(() => setResending(null));
                  }}
                >
                  <RotateCcw className="size-3.5" aria-hidden /> {resending === m.user_id ? t("resending") : t("resend")}
                </Button>
              )}
              {manage && m.user_id !== myUserId && (
                <ConfirmButton size="sm" confirmLabel={t("confirmRemove")} onConfirm={() => onRemove(m)}>
                  {invited ? t("cancelInvite") : t("remove")}
                </ConfirmButton>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
