import { useTranslation } from "react-i18next";
import { SelectField } from "@/components/SelectField";
import { LANGUAGES } from "@/i18n/i18n";
import { Row } from "./Row";
import { card, cardTitle } from "./settings-ui";
import type { AppSettings } from "./settings.ts";

export function GeneralSettings({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={card}>
      <h3 className={cardTitle}>{t("settings.general.language")}</h3>
      <Row
        label={t("settings.general.languageLabel")}
        hint={t("settings.general.languageHint")}
      >
        <SelectField
          className="w-[200px]"
          aria-label={t("settings.general.languageLabel")}
          value={settings.language}
          onValueChange={(language) =>
            onChange({
              ...settings,
              language: language as AppSettings["language"],
            })
          }
          options={["system", ...LANGUAGES].map((value) => ({
            value,
            label: t(
              `language.${value as "system" | (typeof LANGUAGES)[number]}`,
            ),
          }))}
        />
      </Row>
    </section>
  );
}
