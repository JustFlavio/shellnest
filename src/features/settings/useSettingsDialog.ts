import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "@/lib/platform";
import type { SettingsSection } from "./SettingsNav";
import type { VaultApi } from "@/features/vault/useVault";

export function useSettingsDialog({
  view,
  run,
  invokeScoped,
  setError,
}: VaultApi) {
  const [section, setSection] = useState<SettingsSection | null>(null),
    [remembered, setRemembered] = useState<boolean | null>(null);
  const isOpen = section !== null;
  // Creating, switching or locking leaves the unlock screen; settings must not reappear on the next unlock.
  if (!view.unlocked && isOpen) setSection(null);
  // The remembered flag is read again whenever the dialog opens or the vault changes.
  const rememberedFor =
    isOpen && view.unlocked && desktop ? view.vaultId : null;
  const [loadedFor, setLoadedFor] = useState(rememberedFor);
  if (rememberedFor !== loadedFor) {
    setLoadedFor(rememberedFor);
    setRemembered(null);
  }
  useEffect(() => {
    if (rememberedFor === null) return;
    let current = true;
    void invoke<boolean>("is_remembered", { vaultId: rememberedFor }).then(
      (on) => {
        if (current) setRemembered(on);
      },
    );
    return () => {
      current = false;
    };
  }, [rememberedFor]);
  const open = (next: SettingsSection = "general") => {
    setError("");
    setSection(next);
  };
  const close = () => {
    setSection(null);
    setError("");
  };
  const changeSection = (next: SettingsSection) => {
    setError("");
    setSection(next);
  };
  const remember = (enabled: boolean) =>
    void run(async () => {
      await invokeScoped("set_remembered", { enabled });
      setRemembered(enabled);
    });
  return {
    section,
    hide: () => setSection(null),
    open,
    close,
    changeSection,
    remembered,
    remember,
  };
}
