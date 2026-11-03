import { useTranslation } from "react-i18next";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { help } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import { useApp } from "@/app/app-context";
import { unlockLabel } from "./vault-copy.ts";

export function UnlockForm() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    unlock,
  } = useApp();
  // A vault on the server opens with the account password, the same for all its vaults.
  const server = view.vaults.find((v) => v.id === view.vaultId)?.remote;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        unlock.submit();
      }}
    >
      <label>
        {server
          ? t("vault.unlockForm.accountPassword")
          : t("vault.unlockForm.mainPassword")}
        <PasswordInput
          autoFocus
          autoComplete={view.exists ? "current-password" : "new-password"}
          minLength={view.exists ? 1 : 12}
          required
          value={unlock.password}
          onChange={(e) => unlock.setPassword(e.target.value)}
        />
      </label>
      {server && view.account && (
        <p className={help}>
          {t("vault.serverSettings.signedInAs", {
            username: view.account.username,
            server: view.account.server,
          })}
        </p>
      )}
      {!view.exists && (
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
      {desktop && (
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
        {unlockLabel({ busy, exists: view.exists })}
      </Button>
    </form>
  );
}
