import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Row } from "@/features/settings/Row";
import { card, cardTitle } from "@/features/settings/settings-ui";

export function RememberSetting({
  vaultName,
  onServer,
  remembered,
  onRemember,
}: {
  vaultName: string;
  // A server vault remembers the account key, which opens all the account's vaults.
  onServer: boolean;
  remembered: boolean;
  onRemember: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={card}>
      <h3 className={cardTitle}>
        {t("vault.rememberSetting.unlockTitle", { name: vaultName })}
      </h3>
      <Row
        label={t("vault.rememberSetting.rememberOnThisDevice")}
        hint={
          onServer
            ? t("vault.rememberSetting.accountKeyStaysIn")
            : t("vault.rememberSetting.theKeyStaysIn")
        }
      >
        <Switch
          label={t("vault.rememberSetting.rememberOnThisDevice")}
          checked={remembered}
          onChange={onRemember}
        />
      </Row>
    </section>
  );
}
