import Link from "next/link";
import { LogoMark } from "@/components/gpu/logo-mark";

const columns: { title: string; links: [string, string][] }[] = [
  { title: "Use it", links: [["/dashboard", "Mission control"], ["/provide", "Earn with your device"], ["/earnings", "Earnings"], ["/verify", "Verify a payout"]] },
  { title: "On-chain", links: [["/chain", "Escrow ledger"], ["/chain#reserves", "Proof of reserves"], ["/settlement", "Settlement"], ["/status", "System status"], ["/admin", "Owner console"]] },
  { title: "Help", links: [["/help", "Questions and answers"], ["/#how", "How it works"], ["/help#badges", "What the badges mean"], ["/security", "Report a problem"]] },
  { title: "Legal", links: [["/privacy", "Privacy"], ["/privacy#cookies", "Cookies and storage"], ["/terms", "Terms of use"], ["/security", "Security"]] },
];

/** Shared footer for every dashboard screen. The landing page has its own dark version with the same links. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1840px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
            <LogoMark />
            Ekido
          </Link>
          <p className="mt-3 max-w-xs text-sm text-ink-2">Your own AI model, built by devices people already have. Paid for only when it passes your test.</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2 text-sm">
            <span className="font-semibold text-ink">{col.title}</span>
            {col.links.map(([href, label]) => (
              <Link key={href + label} href={href} className="text-ink-2 hover:text-ink">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1840px] px-4 pb-28 pt-4 text-xs text-muted sm:px-6">
          Runs on the Base Sepolia test network with test USDC, which has no value. The contracts are unaudited. Nothing here is financial advice. Type: Zodiak and Satoshi by the Indian Type Foundry, via Fontshare.
        </p>
      </div>
    </footer>
  );
}
