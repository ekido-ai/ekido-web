"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, LogOut, UserRound, Wallet } from "lucide-react";
import { injectedProvider } from "@/lib/wallet/escrow";
import { DEMO_ADDRESSES, restoreSession, sessionStore, signIn, signOut, viewAs } from "@/lib/wallet/session";
import { friendlyError } from "@/lib/wallet/escrow";
import { cx } from "@/components/ui/cx";
import { useKeepInView } from "@/components/ui/keep-in-view";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

let restored = false;

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.getServer);
}

const DEMOS: { role: keyof typeof DEMO_ADDRESSES; label: string; note: string; href: string }[] = [
  { role: "client", label: "Demo client", note: "Jobs paid for and refunds", href: "/account" },
  { role: "provider", label: "Demo provider", note: "Earnings and withdrawals", href: "/account" },
  { role: "owner", label: "Demo owner", note: "The owner console", href: "/admin" },
];

/** Header control: "Sign in" opens a menu (a wallet, or a read-only demo account); signed in, the address and its menu. */
export function WalletButton({ dark = false }: { dark?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const [hasWallet, setHasWallet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // On phones the button can sit mid-row, so its popups are shifted back on screen (ekido-ai/ekido-core#124).
  const signInMenu = useKeepInView<HTMLDivElement>(open && !session);
  const accountMenu = useKeepInView<HTMLDivElement>(open && !!session);
  const errorBox = useKeepInView<HTMLParagraphElement>(!!error);

  useEffect(() => {
    if (!restored) {
      restored = true;
      void restoreSession();
    }
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(id);
  }, [error]);

  const base = dark
    ? "border-white/20 text-white hover:border-white/40"
    : "border-line-strong bg-surface-2 text-ink hover:bg-surface-3";

  async function go() {
    setBusy(true);
    setError(null);
    setOpen(false);
    try {
      await signIn(injectedProvider());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function demo(role: keyof typeof DEMO_ADDRESSES, href: string) {
    viewAs(role);
    setOpen(false);
    router.push(href);
  }

  function toggle() {
    setHasWallet(injectedProvider() !== null);
    setOpen((o) => !o);
  }

  return (
    <div ref={ref} className="relative">
      {session ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={cx("inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium", base)}>
          <span className={cx("size-2 rounded-full", session.demo ? "bg-warning" : "bg-good")} aria-hidden />
          {session.demo ? <span className="text-xs">Demo · {session.demo}</span> : <span className="font-mono text-xs">{short(session.address)}</span>}
        </button>
      ) : (
        <button type="button" onClick={toggle} disabled={busy} aria-expanded={open} aria-haspopup="menu" className={cx("inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:opacity-60", base)}>
          <Wallet className="size-4" aria-hidden />
          {busy ? "Check your wallet…" : "Sign in"}
        </button>
      )}
      {open && !session && (
        <div ref={signInMenu} role="menu" className="absolute right-0 top-11 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line-strong bg-surface p-2 text-sm text-ink shadow-soft">
          <button role="menuitem" type="button" onClick={go} disabled={!hasWallet} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-70">
            <Wallet className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="block font-medium">Sign in with a wallet</span>
              <span className="block text-xs text-muted">
                {hasWallet ? "Your wallet signs a message. No password, nothing sent." : "No browser wallet here. Install MetaMask or Coinbase Wallet, or try a demo below."}
              </span>
            </span>
          </button>
          <p className="px-2 pb-1 pt-3 text-xs text-muted">Or look around with a read-only demo account</p>
          {DEMOS.map((d) => (
            <button key={d.role} role="menuitem" type="button" onClick={() => demo(d.role, d.href)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-2">
              <Eye className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap font-medium">{d.label}</span>
              <span className="ml-auto text-xs text-muted">{d.note}</span>
            </button>
          ))}
        </div>
      )}
      {open && session && (
        <div ref={accountMenu} role="menu" className="absolute right-0 top-11 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line-strong bg-surface p-2 text-sm text-ink shadow-soft">
          <p className="px-2 pb-2 pt-1 text-xs text-muted">
            {session.demo ? "Read-only demo view of a public testnet address. Nothing can be signed or sent." : "Signed in with a wallet signature until"} {session.demo ? "" : `${new Date(session.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. This tab only.`}
          </p>
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-2">
            <UserRound className="size-4" aria-hidden /> My account
          </Link>
          <button role="menuitem" type="button" onClick={() => { signOut(); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-2">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
      {error && (
        <p ref={errorBox} role="alert" className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-critical bg-surface p-3 text-sm text-ink shadow-soft">
          {error}
        </p>
      )}
    </div>
  );
}
