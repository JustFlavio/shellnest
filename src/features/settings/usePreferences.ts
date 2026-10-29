import { useEffect, useMemo, useState } from "react";
import { applyLanguage } from "@/i18n/language";
import { DEFAULT_SETTINGS, clampFontSize, parseSettings } from "./settings.ts";
import type { AppSettings } from "./settings.ts";
import { hint as shortcutHint, parseOverrides, resolve } from "./shortcuts.ts";
import type { Combo } from "./shortcuts.ts";
import { mac } from "@/lib/platform";

const SETTINGS_KEY = "shellnest.settings";
const SHORTCUTS_KEY = "shellnest.shortcuts";

/** The saved settings, or the defaults when there are none or they cannot be read. */
export function readSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return parseSettings(stored);
    // Before the settings dialog the zoom shortcuts kept the size on its own.
    const legacy = Number(localStorage.getItem("shellnest.fontSize"));
    return legacy
      ? { ...DEFAULT_SETTINGS, fontSize: clampFontSize(legacy) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function usePreferences() {
  const [appSettings, setAppSettings] = useState<AppSettings>(readSettings);
  useEffect(() => {
    void applyLanguage(appSettings.language);
  }, [appSettings.language]);
  const [overrides, setOverrides] = useState<Record<string, Combo[]>>(() => {
    try {
      return parseOverrides(localStorage.getItem(SHORTCUTS_KEY) ?? "");
    } catch {
      return {};
    }
  });
  const bindings = useMemo(() => resolve(overrides), [overrides]);
  return {
    appSettings,
    saveSettings: (next: AppSettings) => {
      setAppSettings(next);
      save(SETTINGS_KEY, next);
    },
    overrides,
    saveOverrides: (next: Record<string, Combo[]>) => {
      setOverrides(next);
      save(SHORTCUTS_KEY, next);
    },
    bindings,
    hint: (id: string) => shortcutHint(id, mac, bindings),
  };
}
