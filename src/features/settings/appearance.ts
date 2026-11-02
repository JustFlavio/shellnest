import { setScheme } from "@/lib/use-theme";
import { appTheme, resolveScheme, themeVars } from "./app-themes.ts";
import type { AppSettings } from "./settings.ts";

/** Paints the interface with the chosen theme and scheme. */
export function applyAppearance(
  settings: Pick<AppSettings, "appTheme" | "colorScheme">,
  systemDark: boolean,
) {
  const scheme = resolveScheme(settings.colorScheme, systemDark);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(
    themeVars(appTheme(settings.appTheme)[scheme]),
  ))
    root.style.setProperty(name, value);
  root.style.colorScheme = scheme;
  setScheme(scheme);
}
