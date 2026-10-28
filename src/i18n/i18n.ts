// Translations: English is the source and the fallback, every other locale is a JSON file beside it.
import i18next from "i18next";
import en from "../locales/en.json" with { type: "json" };
import it from "../locales/it.json" with { type: "json" };

export const LANGUAGES = ["en", "it"] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguagePreference = Language | "system";

/** The first supported language among the wanted ones; `system` means the OS locales, in order. */
export function resolveLanguage(
  preference: string,
  systemLocales: readonly string[],
): Language {
  const wanted = preference === "system" ? systemLocales : [preference];
  for (const locale of wanted) {
    const base = locale.toLowerCase().split(/[-_]/)[0];
    const found = LANGUAGES.find((language) => language === base);
    if (found) return found;
  }
  return "en";
}

export const i18n = i18next.createInstance();
// The resources are bundled, so init finishes before it returns.
void i18n.init({
  resources: { en: { translation: en }, it: { translation: it } },
  lng: "en",
  fallbackLng: "en",
  // React escapes what it renders.
  interpolation: { escapeValue: false },
  initAsync: false,
});

export const t = i18n.t.bind(i18n);
