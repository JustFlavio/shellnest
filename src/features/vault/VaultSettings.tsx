import type { View } from "@/lib/types";
import { RememberSetting } from "./RememberSetting";
import { SyncSettings } from "./SyncSettings";
import { VaultList } from "./VaultList";

export function VaultSettings({
  view,
  busy,
  syncUrl,
  syncToken,
  syncing,
  lastSync,
  onSyncUrl,
  onSyncToken,
  onSaveSync,
  onSyncNow,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  remembered,
  onRemember,
}: {
  view: View;
  busy: boolean;
  syncUrl: string;
  syncToken: string;
  syncing: boolean;
  lastSync: string;
  onSyncUrl: (url: string) => void;
  onSyncToken: (token: string) => void;
  onSaveSync: () => void;
  onSyncNow: () => void;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
  remembered: boolean | null;
  onRemember: (enabled: boolean) => void;
}) {
  return (
    <div className="grid gap-[16px]">
      <VaultList
        view={view}
        busy={busy}
        onSwitch={onSwitch}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />
      {remembered !== null && (
        <RememberSetting
          vaultName={view.vaultName}
          remembered={remembered}
          onRemember={onRemember}
        />
      )}
      <SyncSettings
        view={view}
        busy={busy}
        syncUrl={syncUrl}
        syncToken={syncToken}
        syncing={syncing}
        lastSync={lastSync}
        onSyncUrl={onSyncUrl}
        onSyncToken={onSyncToken}
        onSave={onSaveSync}
        onSyncNow={onSyncNow}
      />
    </div>
  );
}
