import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type SettingsSection =
  "general" | "vault" | "terminal" | "shortcuts" | "updates";
const sections = [
  { id: "general", label: "settings.settingsNav.general" },
  { id: "vault", label: "vault.vaultList.vault" },
  { id: "terminal", label: "settings.settingsNav.terminal" },
  { id: "shortcuts", label: "settings.settingsNav.shortcuts" },
  { id: "updates", label: "settings.settingsNav.updates" },
] as const satisfies readonly { id: SettingsSection; label: string }[];

export function SettingsNav({
  section,
  onSection,
}: {
  section: SettingsSection;
  onSection: (s: SettingsSection) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("settings.settingsNav.settingsSections")}
      className="flex w-[200px] shrink-0 flex-col gap-[2px] border-r border-border p-[10px]"
    >
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-current={section === s.id ? "page" : undefined}
          onClick={() => onSection(s.id)}
          className={cn(
            "h-[34px] rounded-lg px-[12px] text-left text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            section === s.id
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {t(s.label)}
        </button>
      ))}
    </nav>
  );
}
