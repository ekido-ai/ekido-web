import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { EventSourceProvider } from "@/lib/events/source-context";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Downloaded once at build time and served from this site, so nothing loads from Google on stage.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const code = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GPUChain", template: "%s · GPUChain" },
  description: "Recover training across GPUs, refuse bad results, pay for accepted work.",
};

/**
 * Runs before first paint, so a saved light theme never flashes dark.
 * `?theme=light|dark` overrides for one visit without saving (handy for screenshots).
 */
const themeScript = `(function(){try{var q=new URLSearchParams(location.search),d=document.documentElement,t=q.get("theme")||localStorage.getItem("gpuchain.theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" data-style="nexora" className={`h-full antialiased ${display.variable} ${body.variable} ${code.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <EventSourceProvider>
          <AppShell>{children}</AppShell>
        </EventSourceProvider>
      </body>
    </html>
  );
}
