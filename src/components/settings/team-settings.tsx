"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Field, inputClass } from "@/components/auth/field";
import { Button, ConfirmButton } from "@/components/ui/button";
import { ApiKeyList } from "@/components/platform/api-key-list";
import { buttonStyles } from "@/components/ui/button-styles";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import {
  KEY_SCOPES,
  platform,
  PlatformError,
  looksLikeEmail,
  type ApiKey,
  type KeyMode,
  type KeyScope,
  type Me,
  type NewApiKey,
  type Org,
  type Role,
} from "@/lib/platform/api";

type Load = { kind: "loading" } | { kind: "signed-out" } | { kind: "error"; message: string } | { kind: "ready"; me: Me };

/** Ticket C5: the signed-in person's team, members and API keys, all through the Platform API. */
export function TeamSettings() {
  const t = useTranslations("settings");
  const auth = useTranslations("auth");
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  const refresh = useCallback(() => {
    platform
      .me()
      .then((me) => setLoad({ kind: "ready", me }))
      .catch((error) =>
        setLoad(error instanceof PlatformError && error.status === 401 ? { kind: "signed-out" } : { kind: "error", message: error.message }),
      );
  }, []);
  useEffect(refresh, [refresh]);

  if (load.kind === "loading") return <Panel><div className="p-6"><SkeletonLines lines={4} /></div></Panel>;
  if (load.kind === "error") return <ErrorState title={t("loadFailed")} detail={load.message} onRetry={refresh} />;
  if (load.kind === "signed-out")
    return (
      <Panel title={t("signInFirstTitle")} subtitle={t("signInFirst")}>
        <div className="p-6">
          <Link href="/login" className={buttonStyles("primary", "md")}>{auth("headerSignIn")}</Link>
        </div>
      </Panel>
    );

  const { me } = load;
  const org = me.orgs[0];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2">
        <span>{t("signedInAs", { email: me.email ?? "" })}</span>
        <Button size="sm" onClick={() => platform.signOut().finally(() => router.replace("/login"))}>
          <LogOut className="size-4" aria-hidden /> {t("signOut")}
        </Button>
      </div>
      {org ? <TeamPanels orgId={org.org_id} role={org.role} myUserId={me.user_id} /> : <CreateTeam onCreated={refresh} />}
    </div>
  );
}

function CreateTeam({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("settings");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await platform.createOrg(name.trim());
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Panel title={t("createTeamTitle")} subtitle={t("createTeamLead")}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 p-6">
        <Field label={t("teamName")} placeholder={t("teamPlaceholder")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="min-w-64 flex-1" />
        <button type="submit" className={buttonStyles("primary", "md")} disabled={busy || !name.trim()}>{t("createTeam")}</button>
        {error && <div className="w-full"><ErrorState title={error} /></div>}
      </form>
    </Panel>
  );
}

function TeamPanels({ orgId, role, myUserId }: { orgId: string; role: Role; myUserId: string }) {
  const t = useTranslations("settings");
  const manage = role === "owner" || role === "admin";
  const [org, setOrg] = useState<Org | null>(null);
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([platform.org(orgId), platform.keys(orgId)])
      .then(([o, k]) => {
        setError(null);
        setOrg(o);
        setKeys(k);
      })
      .catch((e) => setError((e as Error).message));
  }, [orgId]);
  useEffect(refresh, [refresh]);

  if (error) return <ErrorState title={t("loadFailed")} detail={error} onRetry={refresh} />;
  if (!org || !keys) return <Panel><div className="p-6"><SkeletonLines lines={4} /></div></Panel>;

  return (
    <div className="space-y-6">
      <Panel title={`${t("team")}: ${org.name}`} subtitle={t("yourRole", { role: t(`roles.${role}`) })}>
        <div className="space-y-6 p-6">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t("members")}</h3>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {org.members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0 text-ink [overflow-wrap:anywhere]">
                    {m.email ?? m.user_id} {m.user_id === myUserId && <span className="text-muted">({t("you")})</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-ink-2">{t(`roles.${m.role}`)}</span>
                    {manage && m.user_id !== myUserId && (
                      <ConfirmButton size="sm" confirmLabel={t("confirmRemove")} onConfirm={() => platform.removeMember(orgId, m.user_id).then(refresh, (e) => setError(e.message))}>
                        {t("remove")}
                      </ConfirmButton>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {manage ? <InviteForm orgId={orgId} canMakeOwner={role === "owner"} onInvited={refresh} /> : <p className="text-sm text-muted">{t("readOnly")}</p>}
        </div>
      </Panel>
      <KeysPanel orgId={orgId} keys={keys} manage={manage} onChange={refresh} />
    </div>
  );
}

function InviteForm({ orgId, canMakeOwner, onInvited }: { orgId: string; canMakeOwner: boolean; onInvited: () => void }) {
  const t = useTranslations("settings");
  const auth = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!looksLikeEmail(value)) return setNote({ ok: false, text: auth("badEmail") });
    try {
      await platform.invite(orgId, value, role);
      setNote({ ok: true, text: t("invited", { email: value }) });
      setEmail("");
      onInvited();
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t("invite")}</h3>
        <p className="text-sm text-muted">{t("inviteLead")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("inviteEmail")} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-64 flex-1" />
        <label className="block space-y-1 text-sm text-ink">
          <span className="font-medium">{t("inviteRole")}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
            <option value="member">{t("roles.member")}</option>
            <option value="admin">{t("roles.admin")}</option>
            {canMakeOwner && <option value="owner">{t("roles.owner")}</option>}
          </select>
        </label>
        <button type="submit" className={buttonStyles("secondary", "md")}>{t("sendInvite")}</button>
      </div>
      {note && (note.ok ? <p className="text-sm text-ink-2" role="status">{note.text}</p> : <ErrorState title={note.text} />)}
    </form>
  );
}

function KeysPanel({ orgId, keys, manage, onChange }: { orgId: string; keys: ApiKey[]; manage: boolean; onChange: () => void }) {
  const t = useTranslations("settings");
  const [created, setCreated] = useState<NewApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel title={t("keys")} subtitle={t("keysLead")}>
      <div className="space-y-6 p-6">
        {created && <NewKeySecret secret={created.secret} onDone={() => setCreated(null)} />}
        <ApiKeyList keys={keys} manage={manage} onRevoke={(k) => platform.revokeKey(orgId, k.key_id).then(onChange, (e) => setError(e.message))} />
        {error && <ErrorState title={error} />}
        {manage ? <NewKeyForm orgId={orgId} onCreated={(k) => { setCreated(k); onChange(); }} /> : <p className="text-sm text-muted">{t("readOnly")}</p>}
      </div>
    </Panel>
  );
}

function NewKeyForm({ orgId, onCreated }: { orgId: string; onCreated: (key: NewApiKey) => void }) {
  const t = useTranslations("settings");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<KeyMode>("test");
  const [scopes, setScopes] = useState<KeyScope[]>(["models.read"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError(t("needName"));
    if (scopes.length === 0) return setError(t("needScope"));
    setBusy(true);
    setError(null);
    try {
      onCreated(await platform.createKey(orgId, name.trim(), mode, scopes));
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label={t("keyName")} placeholder={t("keyNamePlaceholder")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <label className="block space-y-1 text-sm text-ink">
          <span className="font-medium">{t("mode")}</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as KeyMode)} className={inputClass}>
            <option value="test">{t("modes.test")}</option>
            <option value="live">{t("modes.live")}</option>
          </select>
        </label>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-ink">{t("scopes")}</legend>
        {KEY_SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={scopes.includes(scope)}
              onChange={(e) => setScopes((s) => (e.target.checked ? [...s, scope] : s.filter((x) => x !== scope)))}
              className="size-4 accent-[var(--accent)]"
            />
            {t(`scopeNames.${scope}`)} <span className="font-mono text-xs text-muted">{scope}</span>
          </label>
        ))}
      </fieldset>
      {error && <ErrorState title={error} />}
      <button type="submit" className={buttonStyles("primary", "md")} disabled={busy}>{t("createKey")}</button>
    </form>
  );
}

function NewKeySecret({ secret, onDone }: { secret: string; onDone: () => void }) {
  const t = useTranslations("settings");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3 rounded-lg border border-accent bg-accent-soft p-4" role="alert">
      <p className="font-semibold text-ink">{t("secretTitle")}</p>
      <p className="text-sm text-ink-2">{t("secretLead")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink">{secret}</code>
        <Button size="sm" onClick={() => navigator.clipboard.writeText(secret).then(() => setCopied(true), () => setCopied(false))}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? t("copied") : t("copy")}
        </Button>
      </div>
      <Button size="sm" variant="primary" onClick={onDone}>{t("done")}</Button>
    </div>
  );
}
