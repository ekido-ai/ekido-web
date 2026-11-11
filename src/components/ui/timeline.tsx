import { StatusIcon, type Tone } from "./status";

export interface TimelineEntry {
  id: string;
  time: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  tone: Tone;
}

/** Vertical event timeline. Plain-language title first, detail second. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line-strong pl-6">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[33px] top-0.5 rounded-full bg-surface p-0.5">
            <StatusIcon tone={e.tone} />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="tabular font-mono text-xs text-muted">{e.time}</span>
            <span className="font-medium text-ink">{e.title}</span>
          </div>
          {e.detail && <p className="mt-0.5 text-sm text-ink-2">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
