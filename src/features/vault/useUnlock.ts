import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import { notifyError } from "@/lib/notify";
import type { View } from "@/lib/types";
import type { VaultApi } from "./useVault";

export function useUnlock({
  view,
  run,
  update,
  invokeScoped,
  setError,
}: VaultApi) {
  const [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [restore, setRestore] = useState(false),
    [url, setUrl] = useState(""),
    [token, setToken] = useState(""),
    [remember, setRemember] = useState(true);
  const submit = () =>
    void run(async () => {
      if (!view.exists && !restore && password !== confirmPassword)
        throw new Error("Le password non coincidono.");
      const next = restore
        ? await invokeScoped<View>("restore_vault", { url, token, password })
        : await invokeScoped<View>("unlock", {
            password,
            create: !view.exists,
          });
      update(next);
      if (desktop && !restore && remember)
        await invoke("set_remembered", {
          vaultId: next.vaultId,
          enabled: true,
        }).catch((e) => notifyError("Password non salvata", e));
      setPassword("");
      setConfirmPassword("");
      setToken("");
    });
  const toggleRestore = () => {
    setRestore(!restore);
    setError("");
  };
  const reset = () => {
    setPassword("");
    setConfirmPassword("");
    setRestore(false);
    setToken("");
  };
  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    restore,
    toggleRestore,
    url,
    setUrl,
    token,
    setToken,
    remember,
    setRemember,
    submit,
    reset,
  };
}
