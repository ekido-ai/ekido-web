import { EmptyState } from "@/components/ui/states";

export function ScreenPlaceholder({
  title,
  purpose,
  due,
  mustShow,
}: {
  title: string;
  purpose: string;
  due: string;
  mustShow: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-ink-2">{purpose}</p>
      </div>
      <EmptyState title={`Not built yet. Planned for ${due}`}>
        Must show: {mustShow.join(" · ")}
      </EmptyState>
    </div>
  );
}
