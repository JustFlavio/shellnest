import { useTranslation } from "react-i18next";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SettingsSection =
  "general" | "appearance" | "vault" | "terminal" | "shortcuts" | "updates";
const sections = [
  { id: "general", label: "settings.settingsNav.general" },
  { id: "appearance", label: "settings.settingsNav.appearance" },
  { id: "vault", label: "vault.vaultList.vault" },
  { id: "terminal", label: "settings.settingsNav.terminal" },
  { id: "shortcuts", label: "settings.settingsNav.shortcuts" },
  { id: "updates", label: "settings.settingsNav.updates" },
] as const satisfies readonly { id: SettingsSection; label: string }[];

// The tab list of the settings dialog; SettingsDialog holds the Tabs root and the panel.
export function SettingsNav() {
  const { t } = useTranslation();
  return (
    <TabsList
      aria-label={t("settings.settingsNav.settingsSections")}
      className="w-[200px] shrink-0 justify-start gap-[2px] rounded-none border-r border-border bg-transparent p-[10px] group-data-vertical/tabs:h-auto"
    >
      {sections.map((s) => (
        <TabsTrigger
          key={s.id}
          value={s.id}
          className="h-[34px] flex-none rounded-lg border-0 px-[12px] text-[13px] font-normal text-muted-foreground hover:bg-accent data-active:bg-accent data-active:text-foreground data-active:shadow-none dark:text-muted-foreground dark:data-active:bg-accent"
        >
          {t(s.label)}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
