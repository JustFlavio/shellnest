import { useTranslation } from "react-i18next";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { help } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import { useApp } from "@/app/app-context";
import { unlockLabel } from "./vault-copy.ts";

function RemoteVaultFields() {
  const { t } = useTranslation();
  const { unlock } = useApp();
  return (
    <>
      <label>
        {t("vault.unlockForm.fullUrlOfThe")}
        <Input
          required
          type="url"
          value={unlock.url}
          onChange={(e) => unlock.setUrl(e.target.value)}
          placeholder="https://sync.example.com"
        />
      </label>
      <label>
        {t("vault.syncSettings.token")}
        <PasswordInput
          autoComplete="off"
          required
          value={unlock.token}
          onChange={(e) => unlock.setToken(e.target.value)}
        />
      </label>
      <p className={help}>{t("vault.unlockForm.copyTheFullUrl")}</p>
    </>
  );
}

export function UnlockForm() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    unlock,
  } = useApp();
  const creating = !view.exists && !unlock.restore;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        unlock.submit();
      }}
    >
      {unlock.restore && <RemoteVaultFields />}
      <label>
        {t("vault.unlockForm.mainPassword")}
        <PasswordInput
          autoFocus
          autoComplete={view.exists ? "current-password" : "new-password"}
          minLength={view.exists || unlock.restore ? 1 : 12}
          required
          value={unlock.password}
          onChange={(e) => unlock.setPassword(e.target.value)}
        />
      </label>
      {creating && (
        <label>
          {t("vault.unlockForm.confirmPassword")}
          <PasswordInput
            autoComplete="new-password"
            required
            value={unlock.confirmPassword}
            onChange={(e) => unlock.setConfirmPassword(e.target.value)}
          />
        </label>
      )}
      {desktop && !unlock.restore && (
        <div className="mt-[16px] flex items-center justify-between gap-[12px] text-[13px]">
          {t("vault.rememberSetting.rememberOnThisDevice")}
          <Switch
            label={t("vault.rememberSetting.rememberOnThisDevice")}
            checked={unlock.remember}
            onChange={unlock.setRemember}
          />
        </div>
      )}
      <Button
        variant="default"
        type="submit"
        className="mt-[8px] h-[40px] w-full"
        disabled={busy}
      >
        {unlockLabel({ busy, exists: view.exists, restore: unlock.restore })}
      </Button>
    </form>
  );
}
