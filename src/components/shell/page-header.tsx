export function PageHeader({ title, children, aside }: { title: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-4xl text-ink sm:text-[2.6rem] sm:leading-[1.1]">{title}</h1>
        {children && <div className="mt-2 max-w-3xl text-[1.05rem] leading-relaxed text-ink-2">{children}</div>}
      </div>
      {aside}
    </div>
  );
}
