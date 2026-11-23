import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrainFlow } from "@/components/train/train-flow";

export const metadata: Metadata = { title: "Train a model", description: "Bring your examples, see the price and the quality bar, pay only if it passes." };

export default async function TrainPage() {
  const t = await getTranslations("train");
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-2 text-ink-2">{t("lead")}</p>
      </div>
      <TrainFlow />
    </div>
  );
}
