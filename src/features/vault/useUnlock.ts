import { useTranslation } from "react-i18next";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import { notifyError } from "@/lib/notify";
import type { View } from "@/lib/types";
import type { VaultApi } from "./useVault";

export function useUnlock({ view, run, update, invokeScoped }: VaultApi) {
  const { t } = useTranslation();
  const [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [remember, setRemember] = useState(true);
  const submit = () =>
    void run(async () => {
      if (!view.exists && password !== confirmPassword)
        throw new Error(t("vault.useUnlock.thePasswordsDoNot"));
      const next = await invokeScoped<View>("unlock", {
        password,
        create: !view.exists,
      });
      update(next);
      if (desktop && remember)
        await invoke("set_remembered", {
          vaultId: next.vaultId,
          enabled: true,
        }).catch((e) => notifyError(t("vault.useUnlock.passwordNotSaved"), e));
      setPassword("");
      setConfirmPassword("");
    });
  const reset = () => {
    setPassword("");
    setConfirmPassword("");
  };
  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    remember,
    setRemember,
    submit,
    reset,
  };
}
