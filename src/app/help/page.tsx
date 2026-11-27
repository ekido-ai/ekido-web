import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Doc, Section } from "@/components/legal/doc";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title"), description: t("metaDescription") };
}

// The words are in messages (help.*); these lists only fix the order. Section ids are fixed so links work in every language.
const FAQ = ["what", "blockchain", "money", "rent", "paid", "dropout", "nothing", "disagree", "custom"] as const;
const BADGES = ["real", "separate", "capped", "fault", "recorded", "local", "synthetic"] as const;
const WORDS = ["escrow", "verifier", "checkpoint", "step", "fencing", "window", "reserves"] as const;
const TROUBLE = ["coordinator", "chain", "provider", "keys"] as const;

const tags = {
  b: (c: React.ReactNode) => <strong>{c}</strong>,
  code: (c: React.ReactNode) => <code>{c}</code>,
  kbd: (c: React.ReactNode) => <kbd>{c}</kbd>,
  chain: (c: React.ReactNode) => <Link href="/chain">{c}</Link>,
  provide: (c: React.ReactNode) => <Link href="/provide">{c}</Link>,
  status: (c: React.ReactNode) => <Link href="/status">{c}</Link>,
};

export default function HelpPage() {
  const t = useTranslations("help");
  return (
    <Doc title={t("title")} updated={t("updated")} intro={t("intro")}>
      <Section id="questions" title={t("questions")}>
        <div className="divide-y divide-line panel rounded-2xl border border-line">
          {FAQ.map((key) => (
            <details key={key} className="group px-5 py-3 [&_li]:ml-0 [&_li]:list-none">
              <summary className="cursor-pointer list-none font-medium text-ink marker:hidden">
                <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90" aria-hidden>
                  ›
                </span>
                {t(`faq.${key}.q`)}
              </summary>
              <div className="mt-2 pl-5 text-ink-2">{t.rich(`faq.${key}.a`, tags)}</div>
            </details>
          ))}
        </div>
      </Section>

      <Section id="badges" title={t("badgesTitle")}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
          {BADGES.map((key) => (
            <div key={key} className="contents">
              <dt className="font-medium text-ink">{t(`badges.${key}.name`)}</dt>
              <dd>{t(`badges.${key}.means`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="words-we-use" title={t("wordsTitle")}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
          {WORDS.map((key) => (
            <div key={key} className="contents">
              <dt className="font-medium text-ink">{t(`words.${key}.word`)}</dt>
              <dd>{t(`words.${key}.means`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="something-isn-t-working" title={t("troubleTitle")}>
        <ul>
          {TROUBLE.map((key) => (
            <li key={key}>{t.rich(`trouble.${key}`, tags)}</li>
          ))}
        </ul>
      </Section>
    </Doc>
  );
}
