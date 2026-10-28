import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Row } from "./Row";
import { Stepper } from "./Stepper";
import { ThemePicker } from "./ThemePicker";
import { card, cardTitle } from "./settings-ui";
import {
  MAX_FONT_SIZE,
  MAX_LINE_HEIGHT,
  MIN_FONT_SIZE,
  MIN_LINE_HEIGHT,
} from "./settings.ts";
import type { AppSettings } from "./settings.ts";

const fontSuggestions = [
  "SF Mono",
  "Menlo",
  "Monaco",
  "Cascadia Code",
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
  "Geist Mono",
  "Consolas",
];

export function TerminalAppearance({
  settings,
  set,
}: {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={card}>
      <h3 className={cardTitle}>
        {t("settings.terminalAppearance.appearance")}
      </h3>
      <Row label={t("settings.terminalAppearance.font")}>
        <>
          <Input
            className="w-[200px]"
            list="terminal-fonts"
            aria-label={t("settings.terminalAppearance.terminalFont")}
            placeholder={t("vault.vaultList.default")}
            maxLength={200}
            value={settings.fontFamily}
            onChange={(e) => set("fontFamily", e.target.value)}
          />
          <datalist id="terminal-fonts">
            {fontSuggestions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </>
      </Row>
      <Row label={t("settings.terminalAppearance.textSize")}>
        <Stepper
          value={settings.fontSize}
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          step={1}
          decrease={t("settings.terminalAppearance.decreaseTextSize")}
          increase={t("settings.terminalAppearance.increaseTextSize")}
          onChange={(size) => set("fontSize", size)}
        />
      </Row>
      <Row label={t("settings.terminalAppearance.lineHeight")}>
        <Stepper
          value={settings.lineHeight}
          min={MIN_LINE_HEIGHT}
          max={MAX_LINE_HEIGHT}
          step={0.05}
          decrease={t("settings.terminalAppearance.decreaseLineHeight")}
          increase={t("settings.terminalAppearance.increaseLineHeight")}
          onChange={(height) => set("lineHeight", height)}
        />
      </Row>
      <ThemePicker
        value={settings.terminalTheme}
        onChange={(theme) => set("terminalTheme", theme)}
      />
    </section>
  );
}
