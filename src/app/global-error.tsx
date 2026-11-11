"use client";

/**
 * Last resort when the root layout itself fails. It renders its own document, so it can't
 * use the app's CSS: styles are inline and match the dark control-room tokens.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const detail = error instanceof Error ? error.message : "An unexpected value was thrown";
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0d0d0d", color: "#f0efec", fontFamily: "system-ui, sans-serif" }}>
        <title>GPUChain: error</title>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>The dashboard failed to load</h1>
          <p style={{ color: "#c3c2b7", marginTop: 8 }}>{detail}</p>
          <p style={{ color: "#c3c2b7" }}>
            If this happens during the demo, switch to the backup video (fallback L4 in the runbook).
          </p>
          <button
            type="button"
            onClick={retry}
            style={{ marginTop: 16, padding: "10px 18px", borderRadius: 8, border: 0, background: "#f0efec", color: "#0b0b0b", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
