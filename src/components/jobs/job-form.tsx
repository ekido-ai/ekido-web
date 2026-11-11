"use client";

import { useState } from "react";
import type { DashboardState } from "@/lib/events/reduce";
import { costPreview, defaultJob, toRequest, validateJob, type CreateJobResponse, type JobErrors, type JobForm } from "@/lib/jobs/spec";
import { post } from "@/lib/live/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { StatusIcon } from "@/components/ui/status";
import { cx } from "@/components/ui/cx";

function Field({
  id,
  label,
  hint,
  unit,
  error,
  value,
  onChange,
  inputMode = "decimal",
}: {
  id: keyof JobForm;
  label: string;
  hint: string;
  unit?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          name={id}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
          className={cx(
            "tabular w-full max-w-48 rounded-lg border bg-surface-2 px-3 py-2 text-ink outline-none focus-visible:outline-2",
            error ? "border-critical" : "border-line-strong",
          )}
        />
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
        {hint}
      </p>
      {error && (
        <p id={`${id}-err`} className="mt-1 flex items-start gap-1.5 text-sm text-ink">
          <StatusIcon tone="critical" className="mt-0.5 size-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

function Fieldset({ legend, text, children }: { legend: string; text: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line p-5">
      <legend className="px-1 text-base font-semibold text-ink">{legend}</legend>
      <p className="mb-4 text-sm text-ink-2">{text}</p>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Step 1: describe the job and register it with the coordinator (POST /jobs). */
export function JobFormStep({ state, onCreated }: { state: DashboardState; onCreated: (r: CreateJobResponse, f: JobForm) => void }) {
  const signedJobsAvailable = false;
  const [form, setForm] = useState<JobForm>(defaultJob);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Reused across retries of the same submission, so a retry can't create two jobs.
  const [idemKey, setIdemKey] = useState<string | null>(null);

  const errors: JobErrors = touched ? validateJob(form) : {};
  const set = (k: keyof JobForm) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setIdemKey(null); // the request changed, so it is a new submission
  };

  const prices = Object.values(state.providers)
    .filter((p) => p.kind !== "INJECTED_FAULT")
    .map((p) => Number(p.price_per_step_usdc))
    .filter((n) => n > 0);
  const price = prices.length ? Math.max(...prices) : null;
  const cost = price ? costPreview(form, price) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // This form does not yet collect provider quotes or a client binding.
    // Secure verifiers cannot settle an unsigned job, so refuse to create one.
    if (!signedJobsAvailable) return;
    setTouched(true);
    if (Object.keys(validateJob(form)).length) return;
    setSubmitting(true);
    setError(null);
    const key = idemKey ?? crypto.randomUUID();
    setIdemKey(key);
    const res = await post<CreateJobResponse>("/jobs", toRequest(form), key);
    setSubmitting(false);
    if (res.ok) onCreated(res.data, form);
    else setError(res.error);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Fieldset legend="What to train" text="An allowlisted workload only: DistilBERT with LoRA on AG News. No user code runs on providers.">
        <div className="sm:col-span-2">
          <span className="block text-sm font-medium text-ink">Workload</span>
          <p className="mt-1 font-mono text-ink">{form.template}</p>
        </div>
        <Field id="logicalBatch" label="Logical batch size" hint="Fixed for the whole job. Each GPU splits it into micro-batches." value={form.logicalBatch} onChange={set("logicalBatch")} error={errors.logicalBatch} inputMode="numeric" />
        <Field id="totalSteps" label="Training steps" hint="Logical steps. One step means the same thing on every GPU." value={form.totalSteps} onChange={set("totalSteps")} error={errors.totalSteps} inputMode="numeric" />
        <Field id="learningRate" label="Learning rate" hint="Peak rate. The schedule depends only on the step number." value={form.learningRate} onChange={set("learningRate")} error={errors.learningRate} />
        <Field id="seed" label="Seed" hint="Fixes data order, so a resumed job sees the same examples." value={form.seed} onChange={set("seed")} error={errors.seed} inputMode="numeric" />
      </Fieldset>

      <Fieldset
        legend="When the result counts as good"
        text="Fixed before any step runs and hashed on-chain. A provider is paid only for work that passes."
      >
        <Field id="minAccuracyPct" label="Minimum final accuracy" unit="%" hint="Checked on the final model only." value={form.minAccuracyPct} onChange={set("minAccuracyPct")} error={errors.minAccuracyPct} />
        <Field
          id="marginPts"
          label="Allowed drop after a recovery"
          unit="accuracy points"
          hint="A checkpoint fails if, with 95% confidence, it is worse than the last accepted one by more than this."
          value={form.marginPts}
          onChange={set("marginPts")}
          error={errors.marginPts}
        />
      </Fieldset>

      <Fieldset legend="Money and time" text="The budget is locked in escrow. Whatever accepted work doesn't earn comes back to you.">
        <Field id="budgetUsdc" label="Budget" unit="test USDC" hint="Testnet only. Never real funds." value={form.budgetUsdc} onChange={set("budgetUsdc")} error={errors.budgetUsdc} />
        <Field id="deadlineMin" label="Deadline" unit="minutes" hint="After this plus a grace period, anyone can trigger a full refund." value={form.deadlineMin} onChange={set("deadlineMin")} error={errors.deadlineMin} inputMode="numeric" />
        <div className="sm:col-span-2 rounded-lg bg-surface-2 px-4 py-3 text-sm">
          {cost && price ? (
            <>
            <p className="flex items-start gap-2 text-ink">
              <StatusIcon tone={cost.enough ? "good" : "warning"} className="mt-0.5" />
              {cost.enough
                ? `At the highest current price (${price.toFixed(4)} USDC per step), every step costs ${cost.fullCost.toFixed(2)} USDC. If all are accepted, ${cost.refundIfAllAccepted.toFixed(2)} USDC comes back.`
                : `At ${price.toFixed(4)} USDC per step this budget covers only ${cost.stepsCovered} of ${form.totalSteps} steps. Raise the budget or the job may not finish.`}
            </p>
            <p className="text-ink-2">If the final model fails the agreed quality test, the whole budget comes back to you, and no provider is paid.</p>
            </>
          ) : (
            <p className="text-ink-2">Cost preview needs provider prices. None are known yet.</p>
          )}
        </div>
      </Fieldset>

      {error && <ErrorState title="Couldn't create the job" detail={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="lg" disabled={!signedJobsAvailable || submitting}>
          {submitting ? "Creating…" : signedJobsAvailable ? "Create job" : "Create job (not available yet)"}
        </Button>
        <span className="text-sm text-ink-2">
          {signedJobsAvailable
            ? "Registers the job with the coordinator. Nothing is paid yet."
            : "Off until signed provider quotes and a client binding are in. See the note at the top of this page."}
        </span>
      </div>
    </form>
  );
}
