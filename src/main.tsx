import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { App } from "@/app/App";
import { i18n } from "@/i18n/i18n";
import { applyLanguage } from "@/i18n/language";
import { readSettings } from "@/features/settings/usePreferences";
import { trackOpener } from "@/lib/opener";
import { desktop } from "@/lib/platform";
import "./theme.css";

if (import.meta.env.MODE === "desktop-e2e") {
  void import("@wdio/tauri-plugin");
}

if (desktop && /Mac/.test(navigator.userAgent))
  document.documentElement.classList.add("mac");
trackOpener();
// The first render waits for the language, so the interface never flashes in the wrong one.
void applyLanguage(readSettings().language).then(() =>
  createRoot(document.getElementById("root")!).render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  ),
);
