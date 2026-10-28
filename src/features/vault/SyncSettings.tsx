import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { card, cardTitle } from "@/features/settings/settings-ui";
import { help, muted } from "@/lib/editor-ui";
import type { View } from "@/lib/types";

export function SyncSettings({
  view,
  busy,
  syncUrl,
  syncToken,
  syncing,
  lastSync,
  onSyncUrl,
  onSyncToken,
  onSave,
  onSyncNow,
}: {
  view: View;
  busy: boolean;
  syncUrl: string;
  syncToken: string;
  syncing: boolean;
  lastSync: string;
  onSyncUrl: (url: string) => void;
  onSyncToken: (token: string) => void;
  onSave: () => void;
  onSyncNow: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={card}>
      <h3 className={cardTitle}>
        {t("vault.syncSettings.title", { name: view.vaultName })}
      </h3>
      <p className={muted}>
        {t("vault.syncSettings.hostsIdentitiesAndKeys")}
        {view.syncConfigured &&
          lastSync &&
          t("vault.syncSettings.lastSyncOk", { time: lastSync })}
      </p>
      <form
        className="mt-[10px] grid gap-[6px]"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label className="grid gap-[6px] text-[13px]">
          {t("vault.syncSettings.serviceUrl")}
          <Input
            required
            type="url"
            placeholder="https://sync.example.com"
            value={syncUrl}
            onChange={(e) => onSyncUrl(e.target.value)}
          />
        </label>
        <p className={help}>
          {view.vaultId === "personal"
            ? t("vault.syncSettings.pathVault")
            : t("vault.syncSettings.pathWillBe", { id: view.vaultId })}
        </p>
        <label className="grid gap-[6px] text-[13px]">
          {t("vault.syncSettings.token")}
          <PasswordInput
            autoComplete="off"
            required={!view.syncConfigured}
            minLength={syncToken ? 32 : undefined}
            placeholder={
              view.syncConfigured
                ? t("vault.syncSettings.leaveEmptyToKeep")
                : t("vault.syncSettings.atLeast32Characters")
            }
            value={syncToken}
            onChange={(e) => onSyncToken(e.target.value)}
          />
        </label>
        <p className={help}>{t("vault.syncSettings.every30SWhile")}</p>
        <div className="flex justify-end gap-[8px]">
          {view.syncConfigured && (
            <Button
              variant="ghost"
              type="button"
              disabled={busy || syncing}
              onClick={onSyncNow}
            >
              <RefreshCw size={14} />
              {t("vault.syncSettings.syncNow")}
            </Button>
          )}
          <Button variant="default" type="submit" disabled={busy}>
            {t("vault.syncSettings.saveConfiguration")}
          </Button>
        </div>
      </form>
    </section>
  );
}
