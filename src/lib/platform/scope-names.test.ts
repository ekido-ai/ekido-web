import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import { KEY_SCOPES } from "./api";

// api.ts reads the site config through the "@/" alias, which plain vitest doesn't resolve; only KEY_SCOPES is needed.
vi.mock("@/lib/config", () => ({ config: {} }));
import { LOCALES } from "../../i18n/request";

/**
 * Every API key scope needs a label in every locale. next-intl reads "." in a key as nesting, so a flat key like
 * "models.read" is never found and the page shows the raw path "settings.scopeNames.models.read" instead
 * (ekido-ai/ekido-core#100). This test fails for any scope whose label is missing.
 */
describe("message keys", () => {
  for (const locale of LOCALES) {
    it(`has no "." inside a key in ${locale}, since next-intl would read it as nesting`, async () => {
      const messages = (await import(`../../../messages/${locale}.json`)).default;
      const dotted: string[] = [];
      const walk = (node: unknown, path: string[]) => {
        if (node === null || typeof node !== "object") return;
        for (const [key, value] of Object.entries(node)) {
          if (key.includes(".")) dotted.push([...path, key].join(" > "));
          walk(value, [...path, key]);
        }
      };
      walk(messages, []);
      expect(dotted).toEqual([]);
    });
  }
});

describe("API key scope labels", () => {
  for (const locale of LOCALES) {
    it(`has a label for every scope in ${locale}`, async () => {
      const messages = (await import(`../../../messages/${locale}.json`)).default;
      const missing: string[] = [];
      const t = createTranslator({ locale, messages, namespace: "settings", onError: (e) => missing.push(e.message) });
      const labels = KEY_SCOPES.map((scope) => t(`scopeNames.${scope}`));
      expect(missing).toEqual([]);
      for (const [i, label] of labels.entries()) {
        expect(label, KEY_SCOPES[i]).not.toContain("scopeNames");
        expect(label.trim().length, KEY_SCOPES[i]).toBeGreaterThan(0);
      }
    });
  }
});
