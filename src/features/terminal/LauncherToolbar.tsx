import { LauncherActions } from "./LauncherActions";

// Workspace actions above the groups; the Esc/arrow handling of the search box must not see them.
export function LauncherToolbar({
  busy,
  canCreate,
  session,
  onCreate,
  onRestore,
}: {
  busy: boolean;
  canCreate: boolean;
  session: { count: number } | null;
  onCreate: () => void;
  onRestore: () => void;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape and arrow keys from the toolbar buttons must not reach the launcher list
    <div
      className="mb-[10px] flex items-center justify-end gap-[2px]"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <LauncherActions
        busy={busy}
        canCreate={canCreate}
        session={session}
        onCreate={onCreate}
        onRestore={onRestore}
      />
    </div>
  );
}
