"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AssistantBox } from "@/components/train/assistant-box";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { cx } from "@/components/ui/cx";
import { Panel } from "@/components/ui/panel";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import { DropZone } from "@/components/platform/drop-zone";
import { QuoteCard } from "@/components/platform/quote-card";
import { platform, PlatformError, type Me } from "@/lib/platform/api";
import { parseCsv, rowsForRecipe, train, type Dataset, type Quote, type Recipe } from "@/lib/platform/train";

/*
 * Tickets C9 and A14's customer side: pick a recipe, bring examples, see the price and the quality bar, pay, and the
 * training starts. Payment is Razorpay Checkout in test mode; the job starts only once Razorpay's webhook has marked
 * the order paid (the Platform checks), never on the browser's word.
 */

type Step = "recipe" | "file" | "quote" | "paying" | "starting";
type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (e: unknown) => void) => void };

function loadCheckout(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay Checkout didn't load.")));
    s.onerror = () => reject(new Error("Razorpay Checkout didn't load. Check your connection."));
    document.body.appendChild(s);
  });
}

export function TrainFlow() {
  const t = useTranslations("train");
  const auth = useTranslations("auth");
  const router = useRouter();
  const [me, setMe] = useState<Me | null | "signed-out">(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [rows, setRows] = useState<{ train: Record<string, string>[]; test: Record<string, string>[] } | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<Step>("recipe");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platform.me().then(setMe).catch((e) => setMe(e instanceof PlatformError && e.status === 401 ? "signed-out" : null));
    train.recipes().then(setRecipes).catch((e) => setError((e as Error).message));
  }, []);

  const org = me && me !== "signed-out" ? me.orgs[0] : undefined;

  const readFile = useCallback(
    async (file: File) => {
      if (!recipe) return;
      setError(null);
      setRows(null);
      setFile(null);
      setReading(file.name);
      try {
        // The drop zone has already refused a wrong type, an empty file and anything over the limit.
        const parsed = rowsForRecipe(parseCsv(await file.text()), recipe);
        if (parsed.test.length < 20) throw new Error(t("needTest", { have: parsed.test.length }));
        setRows(parsed);
        setFile({ name: file.name, size: file.size });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setReading(null);
      }
    },
    [recipe, t],
  );

  async function uploadAndQuote() {
    if (!org || !recipe || !rows) return;
    setBusy(true);
    setError(null);
    try {
      const ds = await train.upload(org.org_id, { recipe_id: recipe.recipe_id, ...rows });
      setDataset(ds);
      setQuote(await train.quote(org.org_id, ds.dataset_id));
      setStep("quote");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** A quote runs out; the examples are already uploaded, so a new price needs only the dataset. */
  async function newQuote() {
    if (!org || !dataset) return;
    setBusy(true);
    setError(null);
    // The expired quote stays on screen (with its button off while busy) until the new one arrives, so a failure
    // leaves "Get a new price" there to try again.
    try {
      setQuote(await train.quote(org.org_id, dataset.dataset_id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function waitForPaidAndStart(orderId: string, quoteId: string) {
    setStep("starting");
    // Starting a job probes a device first, which can outlast one request. So after asking once, keep reading the order:
    // it shows the job id when the start finishes. Two minutes for the payment to arrive, six in all.
    let asked = false;
    for (let i = 0; i < (asked ? 180 : 60); i++) {
      const status = await train.orderStatus(orderId).catch(() => null);
      if (status?.job_id) return router.push(`/jobs/${status.job_id}`);
      if (!asked && status?.status === "HELD") {
        asked = true;
        try {
          const job = await train.start(org!.org_id, quoteId);
          return router.push(`/jobs/${job.job_id}`);
        } catch (e) {
          if (!(e instanceof PlatformError && e.code === "OFFLINE")) throw e;
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setError(t(asked ? "startSlow" : "paymentSlow"));
    setStep("quote");
  }

  async function pay() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const order = await train.order(quote.quote_id);
      const Razorpay = await loadCheckout();
      setStep("paying");
      const checkout = new Razorpay({
        key: order.key_id,
        order_id: order.gateway_order_id,
        amount: order.amount_paise,
        currency: order.currency,
        name: "Ekido",
        description: recipe?.title ?? "Model training",
        theme: { color: "#FE5000" },
        handler: () => void waitForPaidAndStart(order.order_id, quote.quote_id).catch((e) => {
          setError((e as Error).message);
          setStep("quote");
        }),
        modal: { ondismiss: () => setStep((s) => (s === "paying" ? "quote" : s)) },
      });
      checkout.on("payment.failed", () => {
        setError(t("paymentFailed"));
        setStep("quote");
      });
      checkout.open();
    } catch (e) {
      setError((e as Error).message);
      setStep("quote");
    } finally {
      setBusy(false);
    }
  }

  if (me === null && !error) return <Panel><SkeletonLines lines={4} /></Panel>;
  if (me === "signed-out")
    return (
      <Panel title={t("signInTitle")} subtitle={t("signInLead")}>
        <Link href="/login" className={buttonStyles("primary", "md")}>{auth("headerSignIn")}</Link>
      </Panel>
    );
  if (me && !org)
    return (
      <Panel title={t("teamTitle")} subtitle={t("teamLead")}>
        <Link href="/settings" className={buttonStyles("primary", "md")}>{t("teamButton")}</Link>
      </Panel>
    );

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label={t("stepsLabel")}>
        {(["recipe", "file", "quote"] as const).map((s, i) => (
          <li key={s} className={cx("rounded-full px-3 py-1", step === s || (s === "quote" && (step === "paying" || step === "starting")) ? "bg-ink text-surface" : "bg-surface-2 text-ink-2")}>
            {i + 1}. {t(`step.${s}`)}
          </li>
        ))}
      </ol>
      {error && <ErrorState title={t("errorTitle")} detail={error} />}

      {step === "recipe" && org && (
        <AssistantBox
          orgId={org.org_id}
          recipes={recipes}
          onPick={(r) => {
            setRecipe(r);
            setRows(null);
            setStep("file");
          }}
        />
      )}

      {step === "recipe" && (
        <Panel title={t("recipeTitle")} subtitle={t("recipeLead")}>
          {!recipes ? (
            <SkeletonLines lines={4} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recipes.map((r) => (
                <button
                  key={r.recipe_id}
                  type="button"
                  onClick={() => {
                    setRecipe(r);
                    setRows(null);
                    setStep("file");
                  }}
                  className="rounded-xl border border-line bg-surface p-4 text-left hover:border-ink"
                >
                  <span className="block font-semibold text-ink">{r.title}</span>
                  <span className="mt-1 block text-sm text-ink-2">{t("columns", { input: r.columns.input, answer: r.columns.answer })}</span>
                  <span className="mt-1 block text-sm text-ink-2">{r.quality_terms}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {step === "file" && recipe && (
        <Panel title={t("fileTitle", { recipe: recipe.title })} subtitle={t("fileLead", { input: recipe.columns.input, answer: recipe.columns.answer })}>
          <div className="space-y-4">
            <p className="rounded-lg border border-warning bg-surface-2 p-3 text-sm text-ink">{t("privacyNote")}</p>
            {recipe.labels.length > 0 && <p className="text-sm text-ink-2">{t("labels", { labels: recipe.labels.join(", ") })}</p>}
            <DropZone accept={[".csv"]} maxBytes={20 * 1024 * 1024} onFile={(f) => void readFile(f)} reading={reading} chosen={file} disabled={busy} />
            {rows && file && (
              <div className="space-y-3">
                <p className="text-sm text-ink">{t("rowsRead", { file: file.name, train: rows.train.length, test: rows.test.length })}</p>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-2 text-ink-2"><tr><th className="px-3 py-1.5">{recipe.columns.input}</th><th className="px-3 py-1.5">{recipe.columns.answer}</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {rows.train.slice(0, 5).map((r, i) => (
                        <tr key={i}><td className="px-3 py-1.5 text-ink">{r[recipe.columns.input].slice(0, 120)}</td><td className="px-3 py-1.5 text-ink-2">{r[recipe.columns.answer].slice(0, 60)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setStep("recipe")}>{t("back")}</Button>
              <button type="button" className={buttonStyles("primary", "md")} disabled={!rows || busy} onClick={() => void uploadAndQuote()}>
                {busy ? t("uploading") : t("getQuote")}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {(step === "quote" || step === "paying" || step === "starting") && dataset && (
        <Panel title={t("quoteTitle")} subtitle={t("quoteLead", { train: dataset.train_rows, test: dataset.test_rows })}>
          <QuoteCard
            quote={quote}
            payState={step === "quote" ? "idle" : step}
            busy={busy}
            onPay={() => void pay()}
            onNewQuote={() => void newQuote()}
          />
        </Panel>
      )}
    </div>
  );
}

