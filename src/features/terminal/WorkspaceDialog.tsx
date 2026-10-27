import { Panel } from "@/features/hosts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { help } from "@/lib/editor-ui";
import { leafIds } from "./workbench-state.mjs";
import { useApp } from "@/app/app-context";

export function WorkspaceDialog() {
  const {
    vault: { busy, error },
    tabs: { tabs, savingWs, setSavingWs, saveWorkspace },
    library: {},
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
      title={savingWs.hostIds ? "Crea workspace" : "Salva come workspace"}
      busy={busy}
      error={error}
      onClose={() => setSavingWs(null)}
    >
      <p className={help}>
        {savingWs.hostIds
          ? `${savingWs.hostIds.length} host in griglia: lo salvo e lo apro, poi puoi sistemare i pannelli trascinandoli.`
          : "Salva gli host e la disposizione dei pannelli: potrai riaprirli insieme da una nuova scheda."}
      </p>
      {skippedQuick > 0 && (
        <p className={help}>
          {skippedQuick === 1
            ? "1 connessione rapida non verrà salvata: salvala prima come host per includerla."
            : `${skippedQuick} connessioni rapide non verranno salvate: salvale prima come host per includerle.`}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (savingWs.name.trim()) saveWorkspace();
        }}
      >
        <label>
          Nome
          <Input
            autoFocus
            maxLength={80}
            value={savingWs.name}
            onChange={(e) => setSavingWs({ ...savingWs, name: e.target.value })}
          />
        </label>
        <footer>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setSavingWs(null)}
          >
            Annulla
          </Button>
          <Button
            variant="default"
            type="submit"
            className="primary"
            disabled={busy || !savingWs.name.trim()}
          >
            Salva
          </Button>
        </footer>
      </form>
    </Panel>
  );
}
