import { ConnectionLauncher } from "./ConnectionLauncher";
import { useApp } from "./app-context";

export function LauncherPage() {
  const {
    vault: { view, busy, preview },
    preferences: { hint },
    tabs: {
      bar,
      launcherKey,
      setSavingWs,
      connect,
      activateTab,
      openLocal,
      quickConnect,
      lastSession,
      openWorkspace,
      restoreSession,
      deleteWorkspace,
    },
  } = useApp();
  return (
    <ConnectionLauncher
      shortcut={hint("quickConnect")}
      key={`${view.vaultId}-${launcherKey}`}
      vaultName={view.vaultName}
      groups={view.groups}
      workspaces={view.workspaces}
      hosts={view.hosts}
      identities={view.identities}
      tabs={bar.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle:
          t.kind === "local"
            ? "Terminale locale"
            : t.kind === "ssh"
              ? `${t.username}@${t.host.address}`
              : `${t.username}@${t.target.address}`,
      }))}
      onConnect={connect}
      onOpenWorkspace={openWorkspace}
      session={lastSession()}
      onRestore={restoreSession}
      onCreateWorkspace={(hostIds) => setSavingWs({ hostIds, name: "" })}
      onDeleteWorkspace={deleteWorkspace}
      onActivateTab={activateTab}
      onLocalTerminal={openLocal}
      onQuickConnect={quickConnect}
      preview={preview}
      busy={busy}
    />
  );
}
