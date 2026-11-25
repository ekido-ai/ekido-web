import { ArrowUpRight, Check, Clock, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cx } from "@/components/ui/cx";

/*
 * Our measured results, passes and failures alike, each linked to its raw files, and what a customer approves before anything
 * happens. Every number here must stay traceable to the linked folder: change the text only when the evidence changes.
 */

const CORE = "https://github.com/ekido-ai/ekido-core/tree/main/experiments/results";

/** In the order of the "measured" rows in messages: whether it met its bar, and where the raw files are. */
const EVIDENCE: { passed: boolean; href: string }[] = [
  { passed: true, href: "https://github.com/ekido-ai/ekido-web/blob/main/replay/recordings/real-run-2026-11-04.json" },
  { passed: true, href: `${CORE}/three-recipe-distill-20261119` },
  { passed: true, href: `${CORE}/filtered-distillation-20261120` },
  { passed: false, href: `${CORE}/filtered-distillation-20261120` },
  { passed: false, href: `${CORE}/assistant-bakeoff-20261125` },
];

type Row = { name: string; result: string; note: string };
type Step = { title: string; body: string; ready: boolean };

export async function Measured() {
  const t = await getTranslations("proof");
  const rows = t.raw("rows") as Row[];
  return (
    <div className="artifact divide-y divide-line overflow-hidden">
      {rows.map((row, i) => {
        const { passed, href } = EVIDENCE[i];
        return (
          <div key={row.name} className="grid gap-2 p-5 sm:grid-cols-[2rem_1.2fr_1fr_auto] sm:items-center sm:gap-5">
            <span className={cx("grid size-8 place-items-center rounded-lg", passed ? "bg-success/15 text-success" : "bg-accent/12 text-accent-text")}>
              {passed ? <Check className="size-4.5" aria-label={t("passed")} /> : <X className="size-4.5" aria-label={t("failed")} />}
            </span>
            <span>
              <span className="block font-semibold text-ink">{row.name}</span>
              <span className="block text-sm text-ink-2">{row.note}</span>
            </span>
            <span className="text-[15px] font-semibold text-ink">{row.result}</span>
            <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:underline">
              {t("raw")} <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        );
      })}
    </div>
  );
}

export async function Approvals() {
  const t = await getTranslations("proof");
  const steps = t.raw("steps") as Step[];
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((step) => (
        <li key={step.title} className="artifact p-6">
          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", step.ready ? "bg-success/15 text-success" : "bg-surface-2 text-ink-2")}>
            {step.ready ? <Check className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
            {step.ready ? t("ready") : t("building")}
          </span>
          <h3 className="mt-4 text-ink">{step.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
