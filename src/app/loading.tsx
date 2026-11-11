export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1840px] space-y-6" role="status" aria-live="polite" aria-busy="true">
      <p className="text-sm text-ink-2">Loading page…</p>
      <div className="loading-shimmer h-8 w-48 max-w-full rounded-lg" aria-hidden />
      <div className="loading-shimmer h-24 rounded-xl border border-line" aria-hidden />
      <div className="grid gap-4 md:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((item) => <div key={item} className="loading-shimmer h-32 rounded-xl border border-line" />)}
      </div>
    </div>
  );
}
