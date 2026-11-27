"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/auth/field";
import { buttonStyles } from "@/components/ui/button-styles";
import { RetryNotice } from "@/components/platform/retry-notice";
import { ErrorState } from "@/components/ui/states";
import { useTypedBeforeHydration } from "@/components/ui/typed-before-hydration";
import { looksLikeEmail, platform, PlatformError } from "@/lib/platform/api";

/** Email sign-in (ticket C5): one form for new and returning people; the Platform sends a one-time link. */
export function SignInForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const emailField = useRef<HTMLInputElement>(null);
  // An email typed before the script loaded would otherwise be lost on submit (ekido-ai/ekido-core#125).
  useTypedBeforeHydration(emailField, setEmail);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; email: string }
    | { kind: "error"; message: string }
    | { kind: "wait"; email: string; until: number }
  >({ kind: "idle" });

  async function request(value: string) {
    setState({ kind: "sending" });
    try {
      await platform.startEmailSignIn(value);
      setState({ kind: "sent", email: value });
    } catch (error) {
      if (error instanceof PlatformError && error.retryAfter)
        setState({ kind: "wait", email: value, until: Date.now() + error.retryAfter * 1000 });
      else setState({ kind: "error", message: error instanceof PlatformError ? error.message : t("badEmail") });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!looksLikeEmail(value)) return setState({ kind: "error", message: t("badEmail") });
    await request(value);
  }

  if (state.kind === "sent") {
    return (
      <div className="space-y-4" role="status">
        <MailCheck className="size-8 text-accent-text" aria-hidden />
        <h2 className="text-xl font-semibold text-ink">{t("sentTitle")}</h2>
        <p className="text-ink-2">{t("sent", { email: state.email })}</p>
        <button type="button" className={buttonStyles("secondary", "md")} onClick={() => setState({ kind: "idle" })}>
          {t("useAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field ref={emailField} label={t("emailLabel")} type="email" name="email" autoComplete="email" inputMode="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
      {state.kind === "error" && <ErrorState title={state.message} />}
      {state.kind === "wait" && (
        <RetryNotice key={state.until} title={t("waitTitle")} detail={t("waitDetail")} until={state.until} againLabel={t("sendAgain")} onAgain={() => void request(state.email)} />
      )}
      <button type="submit" className={buttonStyles("primary", "md")} disabled={state.kind === "sending" || state.kind === "wait"}>
        {state.kind === "sending" ? t("sending") : t("send")}
      </button>
      <p className="text-sm text-muted">{t("newHere")}</p>
      <p className="text-sm text-muted">
        <Link href="/account" className="underline underline-offset-4 hover:text-ink">{t("walletNote")}</Link>
      </p>
    </form>
  );
}
