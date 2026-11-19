import { getRequestConfig } from "next-intl/server";

/*
 * Every piece of visible text lives in messages/<locale>.json (ticket C21). English is the only language served for
 * now: hi.json is still a copy of en.json until each string has a reviewed Hindi translation, and there is no
 * language switcher yet.
 *
 * The locale is deliberately not read from a cookie here. The app uses Next.js cache components, and reading a
 * cookie in the root layout makes every page request-time and fails static prerendering. When the switcher arrives,
 * read the `ekido-locale` cookie inside a Suspense boundary (or move the locale into the URL).
 */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
