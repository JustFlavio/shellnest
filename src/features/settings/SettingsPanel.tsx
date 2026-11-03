import { SettingsDialog } from "./SettingsDialog";
import { UpdateSettings } from "./UpdateSettings";
import { VaultSettings } from "@/features/vault/VaultSettings";
import { mac } from "@/lib/platform";
import { useApp } from "@/app/app-context";

export function SettingsPanel() {
  const {
    vault: { view, busy, error },
    preferences: {
      appSettings,
      saveSettings,
      overrides,
      saveOverrides,
      bindings,
    },
    session: { requestSwitch, openCreateDialog, openRenameDialog, deleteVault },
    update,
    settings,
  } = useApp();
  if (!settings.section) return null;
  return (
    <SettingsDialog
      section={settings.section}
      onSection={settings.changeSection}
      onClose={settings.close}
      error={error}
      busy={busy}
      settings={appSettings}
      onSettings={saveSettings}
      bindings={bindings}
      overrides={overrides}
      onOverrides={saveOverrides}
      mac={mac}
      updates={
        <UpdateSettings
          settings={appSettings}
          onChange={saveSettings}
          update={update}
        />
      }
      vault={
        <VaultSettings
          view={view}
          busy={busy}
          remembered={settings.remembered}
          onRemember={settings.remember}
          onSwitch={requestSwitch}
          onCreate={openCreateDialog}
          onRename={openRenameDialog}
          onDelete={deleteVault}
        />
      }
    />
  );
}
