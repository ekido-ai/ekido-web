"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Radio, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useDashboard, usePlayerSnapshot, useSourceControl } from "@/lib/events/source-context";
import { formatClock } from "@/lib/events/describe";
import { config } from "@/lib/config";
import { TruthBadge } from "@/components/ui/truth-badge";
import { recordingTruth } from "@/lib/events/truth";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { ThemeToggle } from "./theme-toggle";
import { ReplayBar } from "./replay-bar";
import { MomentToasts } from "./moment-toasts";
import { Shortcuts } from "./shortcuts";
import { CoordinatorOffline } from "./coordinator-offline";
import { ChainPulse } from "@/components/chain/chain-pulse";
import { WalletButton } from "@/components/wallet/wallet-button";
import { AccountLink } from "@/components/shell/account-link";
import { MarketingMenu, MarketingNav } from "./marketing-nav";
import { NavGroups } from "./nav-groups";
import { ScrollAnimator } from "@/components/motion/scroll-animator";
import { SiteFooter } from "./site-footer";
import { LogoMark } from "@/components/gpu/logo-mark";
import { EasterEggs } from "@/components/gpu/easter-eggs";
import { StorageNotice } from "./storage-notice";

/** Screens that show a job, and so need the live/recorded controls. */
const DASH_PATHS = ["/dashboard", "/recovery", "/quality", "/settlement", "/verify", "/earnings", "/replay", "/jobs/new"];


/**
 * Live | Recorded switch. Always visible, so nobody has to find a settings page to know
 * (or change) whether the screen shows a real job or a recording.
 */
function ModeSwitch() {
  const { mode, setMode } = useSourceControl();
  const { live } = useDashboard();
  const liveDot =
    live.connection === "live" ? "bg-good" : live.connection === "connecting" ? "bg-ink-2" : mode === "live" ? "bg-warning" : "bg-muted";
  const item = (active: boolean) =>
    cx(
      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors sm:px-2.5",
      active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
    );
  return (
    <div role="radiogroup" aria-label="What to show" className="flex items-center rounded-lg border border-line bg-surface-2 p-0.5">
      <button type="button" role="radio" aria-checked={mode === "live"} onClick={() => setMode("live")} className={item(mode === "live")}>
        <span className={cx("size-2 rounded-full", liveDot)} aria-hidden />
        Live
      </button>
      <button type="button" role="radio" aria-checked={mode === "replay"} onClick={() => setMode("replay")} className={item(mode === "replay")}>
        <History className="size-3.5" aria-hidden />
        Recorded
      </button>
    </div>
  );
}

/**
 * One line under the header that says, in words, what every number below is.
 * Offline is not a footnote: it gets the recovery card with working buttons.
 */
function SourceBar() {
  const view = useDashboard();
  const snap = usePlayerSnapshot();
  const { setMode, watchRecording } = useSourceControl();
  const path = usePathname();
  const { mode, live } = view;
  const local = config.localChain || view.state.chain.some((t) => t.chain === "anvil");
  const synthetic = config.fallbackSynthetic || (mode === "live" && live.synthetic);
  const unreachable = mode === "live" && (live.connection === "offline" || live.connection === "reconnecting");
  // Mission control shows the full recovery card itself when it has nothing to draw.
  const fullCardOnPage = path === "/dashboard" && view.state.log.length === 0;

  let main: React.ReactNode;
  if (unreachable) {
    main = fullCardOnPage ? null : <CoordinatorOffline compact />;
  } else if (mode === "replay") {
    main = (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 panel rounded-2xl border border-line px-4 py-2.5">
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
          <TruthBadge truth={recordingTruth(view.provenance) ?? "RECORDED"} />
          <span>
            <b className="font-semibold">You are watching a recording</b> of the 4 Nov run (RTX 3060, local chain). Nothing here is
            happening right now.
          </span>
          <span className="tabular text-ink-2">
            {snap.playing ? "Playing" : "Paused"} at {formatClock(snap.positionMs)}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => watchRecording(2)} className={buttonStyles("ghost", "sm")}>
            <RotateCcw className="size-3.5" aria-hidden /> Play from start
          </button>
          <button type="button" onClick={() => setMode("live")} className={buttonStyles("secondary", "sm")}>
            <Radio className="size-3.5" aria-hidden /> Switch to live
          </button>
        </div>
      </div>
    );
  } else {
    const connected = live.connection === "live";
    main = (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 panel rounded-2xl border border-line px-4 py-2.5">
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
          <span
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              connected ? "border-good text-ink" : "border-line-strong text-ink-2",
            )}
          >
            <span className={cx("size-2 rounded-full", connected ? "bg-good" : "animate-pulse bg-ink-2 motion-reduce:animate-none")} aria-hidden />
            {connected ? "Live" : "Connecting"}
          </span>
          <span>
            {connected ? (
              <>
                <b className="font-semibold">Live</b> from the coordinator at <code className="font-mono">{config.coordinatorUrl}</code>
              </>
            ) : (
              <>Connecting to the coordinator at <code className="font-mono">{config.coordinatorUrl}</code>…</>
            )}
          </span>
        </p>
        <button type="button" onClick={() => setMode("replay")} className={buttonStyles("ghost", "sm")}>
          <History className="size-3.5" aria-hidden /> Watch the recording instead
        </button>
      </div>
    );
  }

  if (!main && !local && !synthetic) return null;
  return (
    <div className="mx-auto mt-4 w-full max-w-[1840px] space-y-2 px-4 sm:px-6">
      {main}
      {(synthetic || local) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm text-ink-2">
          {synthetic && (
            <span className="flex flex-wrap items-center gap-2">
              <TruthBadge truth="SYNTHETIC" />
              <span className="hidden sm:inline">CPU fallback: a small workload through the same pipeline. Loss and accuracy are not the real model&apos;s.</span>
            </span>
          )}
          {local && (
            <span className="flex flex-wrap items-center gap-2">
              <TruthBadge truth="LOCAL_CHAIN" />
              <span className="hidden sm:inline">Payments on a local Anvil chain, not Base Sepolia.</span>
            </span>
          )}
          {mode === "live" && synthetic && local && (
            <span>Local demos can use short dispute windows; check the job&apos;s on-chain terms.</span>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // The live/recorded controls and the coordinator banner belong to the screens that show a job.
  const dash = DASH_PATHS.some((p) => path.startsWith(p));
  // The home page is the product site: its own section links and one primary button, no chain status.
  const landing = path === "/" || ["/products/", "/solutions", "/developers", "/pricing", "/trust", "/roadmap"].some((p) => path.startsWith(p));
  return (
    <div className="app-backdrop relative flex min-h-full flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-ink-inverse focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <header className="header-ember sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1840px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:gap-x-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink" title="About Ekido">
            <LogoMark />
            Ekido
          </Link>
          {landing ? <MarketingNav /> : <NavGroups path={path} />}
          <div className="ml-auto flex items-center gap-1 2xl:ml-0">
            {!landing && <ChainPulse />}
            <WalletButton />
            {/* On a phone the marketing pages put sign-in in the Menu, so the link shows there only from sm up. */}
            <AccountLink path={path} hideOnPhone={landing} />
            {landing && (
              <Link href="/dashboard" className="press inline-flex h-9 items-center rounded-full bg-action px-4 text-sm font-semibold text-action-ink hover:bg-action-hover sm:ml-1">
                Open the app
              </Link>
            )}
            {dash && <ModeSwitch />}
            {dash && (
            <Link
              href="/replay"
              aria-current={path.startsWith("/replay") ? "page" : undefined}
              title="Data source details and the raw event stream"
              aria-label="Data source details"
              className={cx(
                "hidden h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium sm:inline-flex",
                path.startsWith("/replay") ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              <span className="hidden xl:inline">Data source</span>
            </Link>
            )}
            <span className="hidden sm:contents">
              <Shortcuts />
            </span>
            <ThemeToggle />
            {landing && <MarketingMenu />}
          </div>
        </div>
      </header>
      {dash && <SourceBar />}
      <main id="main" key={path} className={cx("page-enter mx-auto w-full max-w-[1840px] flex-1 px-4 pt-5 sm:px-6", landing ? "pb-0" : "pb-16")}>
        {children}
      </main>
      <SiteFooter />
      <StorageNotice />
      <EasterEggs />
      <ScrollAnimator />
      {dash && <ReplayBar />}
      <MomentToasts />
    </div>
  );
}
