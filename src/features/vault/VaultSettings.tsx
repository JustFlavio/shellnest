import type { View } from "@/lib/types";
import { RememberSetting } from "./RememberSetting";
import { ServerSettings } from "./ServerSettings";
import { VaultList } from "./VaultList";

export function VaultSettings({
  view,
  busy,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  remembered,
  onRemember,
}: {
  view: View;
  busy: boolean;
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
          onServer={!!view.remote}
          remembered={remembered}
          onRemember={onRemember}
        />
      )}
      <ServerSettings />
    </div>
  );
}
