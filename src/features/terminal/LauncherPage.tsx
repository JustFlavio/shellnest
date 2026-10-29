import { useTranslation } from "react-i18next";
import { ConnectionLauncher } from "./ConnectionLauncher";
import { useApp } from "@/app/app-context";

export function LauncherPage() {
  const { t } = useTranslation();
  const {
    vault: { view, busy, preview },
    preferences: { hint },
    tabs: {
      tabs,
      bar,
      lastActive,
      launcherKey,
      launcherMode,
      setSavingWs,
      connect,
      activateTab,
      openLocal,
      startQuick,
      connectHosts,
      openWorkspace,
      deleteWorkspace,
    },
  } = useApp();
  return (
    <ConnectionLauncher
      mode={launcherMode}
      shortcut={hint("quickConnect")}
      jumpShortcut={hint("jumpTab")}
      key={`${view.vaultId}-${launcherKey}`}
      vaultName={view.vaultName}
      groups={view.groups}
      workspaces={view.workspaces}
      hosts={view.hosts}
      identities={view.identities}
      tabs={bar.map((tab) => ({
        id: tab.id,
        title: tab.title,
        subtitle:
          tab.kind === "local"
            ? t("hosts.vaultToolbar.localTerminal")
            : tab.kind === "ssh"
              ? `${tab.username}@${tab.host.address}`
              : `${tab.username ? `${tab.username}@` : ""}${tab.target.address}`,
        hostId: tab.kind === "ssh" ? tab.host.id : undefined,
        paneHostIds: tabs.flatMap((pane) =>
          pane.parent === tab.id && pane.kind === "ssh" ? [pane.host.id] : [],
        ),
        lastActive: lastActive(tab.id),
      }))}
      onConnect={connect}
      onOpenWorkspace={openWorkspace}
      onRestore={connectHosts}
      onCreateWorkspace={(hostIds) => setSavingWs({ hostIds, name: "" })}
      onDeleteWorkspace={deleteWorkspace}
      onActivateTab={activateTab}
      onLocalTerminal={openLocal}
      onQuickConnect={startQuick}
      preview={preview}
      busy={busy}
    />
  );
}
