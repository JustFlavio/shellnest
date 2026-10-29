import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Row } from "./Row";
import { card, cardTitle } from "./settings-ui";
import type { AppSettings } from "./settings.ts";

export function TerminalBehavior({
  settings,
  set,
  mac,
}: {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  mac: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className={card}>
      <h3 className={cardTitle}>{t("settings.terminalBehavior.behavior")}</h3>
      <Row label={t("settings.terminalBehavior.copyTheSelectionAutomatically")}>
        <Switch
          label={t("settings.terminalBehavior.copyTheSelectionAutomatically")}
          checked={settings.copyOnSelect}
          onChange={(v) => set("copyOnSelect", v)}
        />
      </Row>
      <Row label={t("settings.terminalBehavior.pasteWithTheRight")}>
        <Switch
          label={t("settings.terminalBehavior.pasteWithTheRight")}
          checked={settings.rightClickPaste}
          onChange={(v) => set("rightClickPaste", v)}
        />
      </Row>
      <Row label={t("settings.terminalBehavior.bellSound")}>
        <Switch
          label={t("settings.terminalBehavior.bellSound")}
          checked={settings.bell}
          onChange={(v) => set("bell", v)}
        />
      </Row>
      {mac && (
        <Row
          label={t("settings.terminalBehavior.useOptionAsThe")}
          hint={t("settings.terminalBehavior.leaveItOffIf")}
        >
          <Switch
            label={t("settings.terminalBehavior.useOptionAsThe")}
            checked={settings.optionAsMeta}
            onChange={(v) => set("optionAsMeta", v)}
          />
        </Row>
      )}
      <Row label={t("settings.terminalBehavior.brightColorsForBold")}>
        <Switch
          label={t("settings.terminalBehavior.brightColorsForBold")}
          checked={settings.brightBold}
          onChange={(v) => set("brightBold", v)}
        />
      </Row>
      <Row
        label={t("settings.terminalBehavior.scrollbackLines")}
        hint={t("settings.terminalBehavior.from500To100000")}
      >
        <Input
          className="w-[110px]"
          type="number"
          min={500}
          max={100000}
          step={500}
          aria-label={t("settings.terminalBehavior.scrollbackLines")}
          value={settings.scrollback}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n))
              set("scrollback", Math.min(100000, Math.max(500, Math.round(n))));
          }}
        />
      </Row>
    </section>
  );
}
