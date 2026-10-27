import { LauncherActions } from "./LauncherActions";
import { PickingActions } from "./PickingActions";

// Workspace actions above the groups; the Esc/arrow handling of the search box must not see them.
export function LauncherToolbar({
  picked,
  busy,
  canPickHosts,
  session,
  onCancel,
  onCreate,
  onPickHosts,
  onRestore,
}: {
  picked: string[] | null;
  busy: boolean;
  canPickHosts: boolean;
  session: { count: number } | null;
  onCancel: () => void;
  onCreate: () => void;
  onPickHosts: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      className="mb-[10px] flex items-center justify-end gap-[2px]"
      onKeyDown={(event) => event.stopPropagation()}
    >
      {picked ? (
        <PickingActions
          count={picked.length}
          busy={busy}
          onCancel={onCancel}
          onCreate={onCreate}
        />
      ) : (
        <LauncherActions
          busy={busy}
          canPickHosts={canPickHosts}
          session={session}
          onPickHosts={onPickHosts}
          onRestore={onRestore}
        />
      )}
    </div>
  );
}
