import { useTranslation } from "react-i18next";
import { Panel } from "@/features/hosts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { help } from "@/lib/editor-ui";
import { leafIds } from "./workbench-state.ts";
import { useApp } from "@/app/app-context";

export function WorkspaceDialog() {
  const { t } = useTranslation();
  const {
    vault: { busy, error },
    tabs: { tabs, savingWs, setSavingWs, saveWorkspace },
  } = useApp();
  const skippedQuick = (() => {
    const layout = tabs.find((t) => t.id === savingWs?.tabId)?.layout;
    return layout
      ? leafIds(layout).filter(
          (id) => tabs.find((t) => t.id === id)?.kind === "quick",
        ).length
      : 0;
  })();
  if (!savingWs) return null;
  return (
    <Panel
      variant="dialog"
      title={
        savingWs.hostIds
          ? t("terminal.launcherActions.createWorkspace")
          : t("terminal.workspaceDialog.saveAsWorkspace")
      }
      busy={busy}
      error={error}
      onClose={() => setSavingWs(null)}
    >
      {skippedQuick > 0 && (
        <p className={help}>
          {t("terminal.workspaceDialog.quickNotSaved", { count: skippedQuick })}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (savingWs.name.trim()) saveWorkspace();
        }}
      >
        <label>
          {t("vault.vaultPanels.name")}
          <Input
            autoFocus
            maxLength={80}
            value={savingWs.name}
            onChange={(e) => setSavingWs({ ...savingWs, name: e.target.value })}
          />
        </label>
        {!savingWs.hostIds && (
          <p className={help}>
            {t("terminal.workspaceDialog.includesTheHostsAnd")}
          </p>
        )}
        <footer>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setSavingWs(null)}
          >
            {t("vault.deleteVaultDialog.cancel")}
          </Button>
          <Button
            variant="default"
            type="submit"
            className="primary"
            disabled={busy || !savingWs.name.trim()}
          >
            {t("terminal.workspaceDialog.save")}
          </Button>
        </footer>
      </form>
    </Panel>
  );
}
