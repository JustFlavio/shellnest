import { i18n, resolveLanguage } from "./i18n.ts";

/** Switches the interface to the preferred language; `system` follows the operating system. */
export async function applyLanguage(preference: string): Promise<void> {
  const language = resolveLanguage(preference, navigator.languages);
  await i18n.changeLanguage(language);
  document.documentElement.lang = language;
}
