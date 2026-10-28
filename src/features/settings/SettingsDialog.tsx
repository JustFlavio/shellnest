import type { ReactNode } from "react";
import { Panel } from "@/features/hosts/Panel";
import { ShortcutsEditor } from "./ShortcutsEditor";
import { SettingsNav } from "./SettingsNav";
import type { SettingsSection } from "./SettingsNav";
import { TerminalSettings } from "./TerminalSettings";
import type { AppSettings } from "./settings.ts";
import type { Binding, Combo } from "./shortcuts.ts";

export function SettingsDialog({
  section,
  onSection,
  onClose,
  error,
  busy,
  vault,
  updates,
  settings,
  onSettings,
  bindings,
  overrides,
  onOverrides,
  mac,
}: {
  section: SettingsSection;
  onSection: (s: SettingsSection) => void;
  onClose: () => void;
  error: string;
  busy: boolean;
  vault: ReactNode;
  updates: ReactNode;
  settings: AppSettings;
  onSettings: (next: AppSettings) => void;
  bindings: Binding[];
  overrides: Record<string, Combo[]>;
  onOverrides: (next: Record<string, Combo[]>) => void;
  mac: boolean;
}) {
  return (
    <Panel
      variant="dialog"
      title="Impostazioni"
      className="w-[860px] sm:max-w-[calc(100vw-32px)]"
      busy={false}
      error=""
      onClose={onClose}
    >
      <div className="-m-[16px] flex h-[min(620px,calc(100dvh-140px))] min-h-0">
        <SettingsNav section={section} onSection={onSection} />
        <div
          className="min-w-0 flex-1 overflow-auto p-[16px]"
          inert={busy ? true : undefined}
        >
          {error && (
            <p role="alert" className="mb-[12px] text-destructive">
              {error}
            </p>
          )}
          {section === "vault" && vault}
          {section === "updates" && updates}
          {section === "terminal" && (
            <TerminalSettings
              settings={settings}
              onChange={onSettings}
              mac={mac}
            />
          )}
          {section === "shortcuts" && (
            <ShortcutsEditor
              bindings={bindings}
              overrides={overrides}
              mac={mac}
              onChange={onOverrides}
              onResetAll={() => onOverrides({})}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}
