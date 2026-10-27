import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { card, cardTitle } from "@/features/settings/SettingsDialog";
import { help } from "@/lib/editor-ui";
import type { View } from "@/lib/types";
import { DeleteVaultDialog } from "./DeleteVaultDialog";
import { deleteBlock } from "./vault-copy.mjs";

const badge =
  "rounded-[6px] border border-input px-[6px] py-[1px] text-[11px] text-muted-foreground";

function VaultActions({
  view,
  name,
  busy,
  onRename,
  onDelete,
}: {
  view: View;
  name: string;
  busy: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const block = deleteBlock(view);
  return (
    <>
      <span className={badge}>Attivo</span>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label={`Rinomina “${name}”`}
        disabled={busy}
        onClick={onRename}
      >
        <Pencil size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label={`Elimina “${name}”`}
        title={block || undefined}
        disabled={busy || !!block}
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </Button>
    </>
  );
}

export function VaultList({
  view,
  busy,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: {
  view: View;
  busy: boolean;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className={card}>
      <h3 className={cardTitle}>Vault</h3>
      <ul className="m-0 grid list-none gap-[2px] p-0">
        {view.vaults.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-[13px]"
          >
            <span className="truncate">{v.name}</span>
            {v.id === "personal" && <span className={badge}>Predefinito</span>}
            {!v.exists && <span className={badge}>Nuovo</span>}
            <span className="ml-auto flex items-center gap-[4px]">
              {v.id === view.vaultId ? (
                <VaultActions
                  view={view}
                  name={v.name}
                  busy={busy}
                  onRename={onRename}
                  onDelete={() => setConfirming(true)}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={() => onSwitch(v.id)}
                >
                  Passa a questo
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-[10px]">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={busy}
          onClick={onCreate}
        >
          <Plus size={14} />
          Nuovo vault
        </Button>
      </div>
      <p className={help}>
        Rinomina ed elimina agiscono sul vault attivo. Si elimina solo un vault
        vuoto e mai il Personale.
      </p>
      {confirming && (
        <DeleteVaultDialog
          vaultName={view.vaultName}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
        />
      )}
    </section>
  );
}
