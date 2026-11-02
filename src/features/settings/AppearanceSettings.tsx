import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { card, cardTitle } from "./settings-ui";
import { APP_THEMES, COLOR_SCHEMES, appTheme } from "./app-themes.ts";
import type { Palette } from "./app-themes.ts";
import type { AppSettings } from "./settings.ts";

const choice =
  "rounded-[10px] border p-[8px] text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function MiniWindow({ palette }: { palette: Palette }) {
  return (
    <span
      className="flex h-[64px] overflow-hidden rounded-[6px] border"
      style={{ background: palette.background, borderColor: palette.border }}
    >
      <span
        className="grid w-[30%] content-start gap-[4px] p-[6px]"
        style={{ background: palette.sidebar }}
      >
        {[80, 60, 70].map((w) => (
          <i
            key={w}
            className="block h-[3px] rounded-full opacity-50"
            style={{ width: `${w}%`, background: palette.mutedForeground }}
          />
        ))}
      </span>
      <span className="grid flex-1 content-start gap-[5px] p-[7px]">
        <i
          className="block h-[4px] w-[60%] rounded-full"
          style={{ background: palette.foreground }}
        />
        <i
          className="block h-[3px] w-[40%] rounded-full opacity-50"
          style={{ background: palette.mutedForeground }}
        />
        <i
          className="mt-[6px] block h-[10px] w-[34%] rounded-[3px]"
          style={{ background: palette.primary }}
        />
      </span>
    </span>
  );
}

function Swatch({ palette, current }: { palette: Palette; current: boolean }) {
  return (
    <span
      className={cn(
        "grid size-[34px] place-items-center rounded-full border",
        current && "outline-2 outline-offset-2 outline-primary",
      )}
      style={{ background: palette.background, borderColor: palette.input }}
    >
      <i
        className="block size-[12px] rounded-full"
        style={{ background: palette.primary }}
      />
    </span>
  );
}

export function AppearanceSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const { t } = useTranslation();
  const scheme = useTheme();
  const theme = appTheme(settings.appTheme);
  return (
    <div className="grid gap-[16px]">
      <section className={card}>
        <h3 className={cardTitle}>{t("settings.appearance.colorScheme")}</h3>
        <p className="mb-[12px] text-[12px] text-muted-foreground">
          {t("settings.appearance.colorSchemeHint")}
        </p>
        <div
          className="grid grid-cols-3 gap-[8px]"
          role="radiogroup"
          aria-label={t("settings.appearance.colorScheme")}
        >
          {COLOR_SCHEMES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={settings.colorScheme === value}
              onClick={() => onChange({ ...settings, colorScheme: value })}
              className={cn(
                choice,
                "grid gap-[8px] text-center",
                settings.colorScheme === value
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-accent",
              )}
            >
              {value === "system" ? (
                <span className="relative block" aria-hidden>
                  <MiniWindow palette={theme.light} />
                  <span className="absolute inset-0 [clip-path:polygon(55%_0,100%_0,100%_100%,45%_100%)]">
                    <MiniWindow palette={theme.dark} />
                  </span>
                </span>
              ) : (
                <span aria-hidden>
                  <MiniWindow palette={theme[value]} />
                </span>
              )}
              {t(`settings.appearance.${value}`)}
            </button>
          ))}
        </div>
      </section>
      <section className={card}>
        <h3 className={cardTitle}>{t("settings.appearance.theme")}</h3>
        <p className="mb-[12px] text-[12px] text-muted-foreground">
          {t("settings.appearance.themeHint")}
        </p>
        <div
          className="grid grid-cols-3 gap-[8px]"
          role="radiogroup"
          aria-label={t("settings.appearance.theme")}
        >
          {APP_THEMES.map((def) => (
            <button
              key={def.id}
              type="button"
              role="radio"
              aria-checked={settings.appTheme === def.id}
              onClick={() => onChange({ ...settings, appTheme: def.id })}
              className={cn(
                choice,
                "grid justify-items-center gap-[10px] pt-[14px]",
                settings.appTheme === def.id
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-accent",
              )}
            >
              <span className="flex gap-[10px]" aria-hidden>
                <Swatch
                  palette={def.light}
                  current={settings.appTheme === def.id && scheme === "light"}
                />
                <Swatch
                  palette={def.dark}
                  current={settings.appTheme === def.id && scheme === "dark"}
                />
              </span>
              {def.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
