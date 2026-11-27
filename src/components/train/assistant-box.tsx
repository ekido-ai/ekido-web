"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/ui/panel";
import { buttonStyles } from "@/components/ui/button-styles";
import { closestRecipe, MAX_MESSAGE, noticeFor, proposedRecipe, type AssistantAnswer, type AssistantNotice } from "@/lib/platform/assistant";
import { train, type Recipe } from "@/lib/platform/train";

/*
 * The job assistant, at the top of /train. A person describes the job in their own words; the Platform's assistant picks one of the recipes
 * and this page moves to the normal upload step for it. The assistant only chooses a recipe: its replies are fixed text from the Platform,
 * the price comes from the normal quote, and nothing is started from here. The message is kept only in this component's state: not stored
 * in the browser and not logged. It is off until the team switches it on, and says so instead of failing.
 */
export function AssistantBox({ orgId, recipes, onPick }: { orgId: string; recipes: Recipe[] | null; onPick: (recipe: Recipe) => void }) {
  const t = useTranslations("train");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [conversation, setConversation] = useState<string | undefined>();
  const [notice, setNotice] = useState<AssistantNotice | null>(null);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const reply = await train.assistant(orgId, message, conversation);
      setAnswer(reply);
      setConversation(reply.conversation_id);
      setText("");
    } catch (e) {
      const kind = noticeFor(e);
      setNotice(kind);
      if (kind === "notOn") setAnswer(null);
      // A conversation that has expired or was refused starts again on the next message.
      if (kind === "other") setConversation(undefined);
    } finally {
      setBusy(false);
    }
  }

  if (notice === "notOn") {
    return (
      <Panel title={t("assistantTitle")}>
        <p className="text-sm text-ink-2">{t("assistantNotOn")}</p>
      </Panel>
    );
  }

  const proposal = answer && recipes ? proposedRecipe(answer, recipes) : null;
  const closest = answer && recipes ? closestRecipe(answer, recipes) : null;
  const labels = answer?.proposal?.labels ?? [];

  return (
    <Panel title={t("assistantTitle")} subtitle={t("assistantLead")}>
      <div className="space-y-4">
        <label className="block">
          <span className="sr-only">{t("assistantTitle")}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            rows={3}
            maxLength={MAX_MESSAGE}
            placeholder={t("assistantPlaceholder")}
            className="block w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonStyles("primary", "md")} disabled={busy || !text.trim()} onClick={() => void send()}>
            {busy ? t("assistantSending") : t("assistantSend")}
          </button>
          <span className="text-xs text-muted">{t("assistantPrivacy")}</span>
        </div>

        {notice && (
          <p role="alert" className="text-sm text-critical">
            {t(`assistantNotice.${notice}`)}
          </p>
        )}

        {answer && (
          <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4 text-sm" aria-live="polite">
            <p className="text-ink">{answer.reply}</p>
            {proposal && (
              <div className="space-y-2">
                {labels.length > 0 && (
                  <p className="flex flex-wrap items-center gap-2 text-ink-2">
                    {t("assistantLabels")}
                    {labels.map((l) => (
                      <span key={l} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink">
                        {l}
                      </span>
                    ))}
                  </p>
                )}
                <button type="button" className={buttonStyles("primary", "md")} onClick={() => onPick(proposal)}>
                  {t("assistantUse", { recipe: proposal.title })}
                </button>
              </div>
            )}
            {closest && (
              <button type="button" className={buttonStyles("secondary", "md")} onClick={() => onPick(closest)}>
                {t("assistantClosest", { recipe: closest.title })}
              </button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
