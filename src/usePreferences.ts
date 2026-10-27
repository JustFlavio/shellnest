import { useMemo, useState } from "react";
import { DEFAULT_SETTINGS, clampFontSize, parseSettings } from "./settings.mjs";
import type { AppSettings } from "./settings.mjs";
import { hint as shortcutHint, parseOverrides, resolve } from "./shortcuts.mjs";
import type { Combo } from "./shortcuts.mjs";
import { mac } from "./platform";

const SETTINGS_KEY = "shellnest.settings";
const SHORTCUTS_KEY = "shellnest.shortcuts";

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Display preferences kept in localStorage: app settings and shortcut overrides. */
export function usePreferences() {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
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
  });
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
