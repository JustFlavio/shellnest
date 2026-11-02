import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Panel } from "@/features/hosts/Panel";
import { AppearanceSettings } from "./AppearanceSettings";
import { GeneralSettings } from "./GeneralSettings";
import { ShortcutsEditor } from "./ShortcutsEditor";
import { SettingsNav } from "./SettingsNav";
import type { SettingsSection } from "./SettingsNav";
import { TerminalSettings } from "./TerminalSettings";
import type { AppSettings } from "./settings.ts";
import type { Binding, Combo } from "./shortcuts.ts";
import { Alert } from "@/components/ui/alert";

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
  const { t } = useTranslation();
  return (
    <Panel
      variant="dialog"
      title={t("app.appMenu.settings")}
      className="w-[860px] sm:max-w-[calc(100vw-32px)]"
      busy={false}
      error=""
      onClose={onClose}
    >
      <Tabs
        orientation="vertical"
        value={section}
        onValueChange={(next: SettingsSection) => onSection(next)}
        className="-m-[16px] h-[min(620px,calc(100dvh-140px))] min-h-0 flex-row gap-0"
      >
        <SettingsNav />
        <TabsContent
          value={section}
          className="min-w-0 overflow-auto p-[16px] text-[14px]"
          inert={busy ? true : undefined}
        >
          {error && (
            <Alert variant="destructive" className="mb-[12px]">
              {error}
            </Alert>
          )}
          {section === "general" && (
            <GeneralSettings settings={settings} onChange={onSettings} />
          )}
          {section === "appearance" && (
            <AppearanceSettings settings={settings} onChange={onSettings} />
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
        </TabsContent>
      </Tabs>
    </Panel>
  );
}
