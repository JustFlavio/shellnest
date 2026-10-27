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
    sync: { synchronize, syncState, lastSync },
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
          syncUrl={settings.syncUrl}
          syncToken={settings.syncToken}
          syncing={syncState === "syncing"}
          lastSync={lastSync}
          onSyncUrl={settings.setSyncUrl}
          onSyncToken={settings.setSyncToken}
          onSaveSync={settings.saveSync}
          remembered={settings.remembered}
          onRemember={settings.remember}
          onSyncNow={() => void synchronize(true)}
          onSwitch={requestSwitch}
          onCreate={openCreateDialog}
          onRename={openRenameDialog}
          onDelete={deleteVault}
        />
      }
    />
  );
}
