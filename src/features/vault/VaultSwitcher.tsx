import { VaultPicker } from "./VaultPicker";
import { useApp } from "@/app/app-context";

export function VaultSwitcher() {
  const {
    vault: { view, busy },
    session: { openCreateDialog, openRenameDialog, requestSwitch },
    anyPanel,
  } = useApp();
  return (
    <VaultPicker
      view={view}
      busy={busy}
      disabled={anyPanel}
      onSelect={requestSwitch}
      onCreate={openCreateDialog}
      onRename={openRenameDialog}
    />
  );
}
