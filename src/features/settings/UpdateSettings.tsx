import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Row } from "./Row";
import { card, cardTitle } from "./settings-ui";
import { statusLine } from "./update-flow.ts";
import type { AppUpdate } from "./useAppUpdate";
import type { AppSettings } from "./settings.ts";
import pkg from "../../../package.json";

export function UpdateSettings({
  settings,
  onChange,
  update,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  update: AppUpdate;
}) {
  const { t } = useTranslation();
  const { status } = update;
  const [label, run] =
    status.kind === "available"
      ? [t("settings.updateSettings.download"), update.download]
      : status.kind === "ready"
        ? [t("settings.updateSettings.restartNow"), update.restart]
        : [t("settings.updateSettings.checkNow"), update.check];
  return (
    <section className={card}>
      <h3 className={cardTitle}>{t("settings.settingsNav.updates")}</h3>
      <Row label={t("settings.updateSettings.installedVersion")}>
        <span className="text-muted-foreground">Shellnest {pkg.version}</span>
      </Row>
      <Row label={t("settings.updateSettings.checkAtStartup")}>
        <Switch
          label={t("settings.updateSettings.checkAtStartup")}
          checked={settings.checkUpdates}
          onChange={(v) => onChange({ ...settings, checkUpdates: v })}
        />
      </Row>
      <Row label={t("settings.updateSettings.status")}>
        <div className="flex items-center gap-[12px]">
          <span role="status" className="text-right text-muted-foreground">
            {statusLine(status)}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={update.busy}
            onClick={run}
          >
            {label}
          </Button>
        </div>
      </Row>
    </section>
  );
}
