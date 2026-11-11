"use client";

/** A short burst when money lands: the moment people remember. Render it with a new key each time. */
const COLORS = ["var(--accent)", "var(--trust)", "var(--good)", "#fab219"];

export function Celebrate() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.2;
        const dist = 60 + ((i * 37) % 70);
        return (
          <span
            key={i}
            className="burst"
            style={{
              background: COLORS[i % COLORS.length],
              ["--x" as string]: `${Math.cos(angle) * dist}px`,
              ["--y" as string]: `${Math.sin(angle) * dist}px`,
              ["--r" as string]: `${(i * 47) % 360}deg`,
            }}
          />
        );
      })}
    </span>
  );
}
