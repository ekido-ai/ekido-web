"use client";

import { useEffect, useState } from "react";

const steps = [
  { title: "Detect", metric: "0.6 s", body: "A provider stops answering. The coordinator marks it lost and fences off its worker." },
  { title: "Recover", metric: "65 s", body: "A replacement provider resumes from a trusted checkpoint, with micro-batches resized to fit its memory. In this run the providers shared one GPU." },
  { title: "Verify", metric: "2 of 2", body: "In this run two verifiers evaluated selected checkpoints against the last accepted one. A failed test meant that work did not count." },
  { title: "Pay", metric: "per step", body: "Escrow pays each provider for the steps it put into the accepted model and refunds the rest." },
];

/** Four numbered steps; the highlight walks through them, hover or focus takes over. */
export function Steps() {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 3200);
    return () => clearInterval(t);
  }, [held]);

  return (
    <ol className="grid gap-x-8 gap-y-9 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-4" onMouseLeave={() => setHeld(false)}>
      {steps.map((s, i) => {
        const on = i === active;
        return (
          <li
            key={s.title}
            tabIndex={0}
            onMouseEnter={() => {
              setHeld(true);
              setActive(i);
            }}
            onFocus={() => {
              setHeld(true);
              setActive(i);
            }}
            onBlur={() => setHeld(false)}
            className="cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--n-accent)]"
          >
            <p
              className="text-3xl font-semibold tabular tracking-tight transition-colors duration-500 sm:text-5xl"
              style={{ color: on ? "var(--n-accent)" : "var(--n-faint)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </p>
            {/* Progress rule: fills while this step is the active one. */}
            <div aria-hidden className="relative mt-3 h-px w-full bg-[var(--n-line)] sm:mt-6">
              <div
                className="absolute inset-y-0 left-0 bg-[var(--n-accent)]"
                style={{
                  width: on ? "100%" : "0%",
                  transition: on && !held ? "width 3.2s linear" : "width 0.3s ease",
                }}
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 sm:mt-6">
              <h3
                className="text-xl font-semibold tracking-tight transition-colors duration-500"
                style={{ color: on ? "var(--n-ink)" : "var(--n-slate)" }}
              >
                {s.title}
              </h3>
              <span className="font-mono text-xs text-[var(--n-slate)]">{s.metric}</span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--n-ink-2)]">{s.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
