import { useTranslation } from "react-i18next";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import { useTheme } from "@/lib/use-theme";
import {
  MATCH_APP_THEME,
  TERMINAL_THEMES,
  terminalColors,
  type AppSettings,
} from "./settings.ts";

export function ThemePicker({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (theme: AppSettings["terminalTheme"]) => void;
}) {
  const { t } = useTranslation();
  const scheme = useTheme();
  const options = [
    {
      id: MATCH_APP_THEME,
      name: t("settings.themePicker.matchApp"),
      colors: terminalColors(
        { appTheme: settings.appTheme, terminalTheme: MATCH_APP_THEME },
        scheme,
      ),
    },
    ...TERMINAL_THEMES,
  ];
  const value = settings.terminalTheme;
  return (
    <div className="border-t border-border pt-[11px] text-[13px]">
      <div className="mb-[10px]">{t("settings.themePicker.colorTheme")}</div>
      <RadioGroup
        className="grid-cols-2 gap-[8px]"
        aria-label={t("settings.themePicker.colorTheme")}
        value={value}
        onValueChange={onChange}
      >
        {options.map((t) => (
          <RadioGroupCard
            key={t.id}
            value={t.id}
            className="flex items-center gap-[10px] text-left"
          >
            <span
              className="grid h-[34px] w-[52px] shrink-0 content-center gap-[3px] rounded-[6px] border border-border px-[6px]"
              style={{ background: t.colors.background }}
              aria-hidden
            >
              <i
                className="block h-[3px] w-[70%] rounded-full"
                style={{ background: t.colors.foreground }}
              />
              <i
                className="block h-[3px] w-[45%] rounded-full"
                style={{ background: t.colors.green ?? t.colors.cursor }}
              />
              <i
                className="block h-[3px] w-[30%] rounded-full"
                style={{ background: t.colors.cursor }}
              />
            </span>
            {t.name}
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </div>
  );
}
