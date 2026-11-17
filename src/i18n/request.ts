import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/*
 * Every piece of visible text lives in messages/<locale>.json (ticket C21). The language comes from the
 * `ekido-locale` cookie, so URLs stay the same; English is the default. hi.json starts as a copy of en.json
 * until each string has a reviewed Hindi translation.
 */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export default getRequestConfig(async () => {
  const wanted = (await cookies()).get("ekido-locale")?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(wanted ?? "") ? (wanted as Locale) : DEFAULT_LOCALE;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
