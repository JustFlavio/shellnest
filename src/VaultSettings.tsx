import { useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Panel } from "./Editors";
import { AlertDialogDescription } from "./components/ui/alert-dialog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { PasswordInput } from "./PasswordInput";
import { Switch } from "./components/ui/switch";
import { Row, card, cardTitle } from "./SettingsDialog";
import { help, muted } from "./editor-ui";
import type { View } from "./types";

const badge =
  "rounded-[6px] border border-input px-[6px] py-[1px] text-[11px] text-muted-foreground";

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
  const [confirming, setConfirming] = useState(false);
  const isDefault = view.vaultId === "personal";
  const empty =
    !view.hosts.length &&
    !view.identities.length &&
    !view.keys.length &&
    !view.groups.length &&
    !view.workspaces.length;
  const deleteBlock = isDefault
    ? "Il vault Personale non si può eliminare"
    : !empty
      ? "Svuota prima il vault: host, identità, chiavi e cartelle"
      : "";
  return (
    <div className="grid gap-[16px]">
      <section className={card}>
        <h3 className={cardTitle}>Vault</h3>
        <ul className="m-0 grid list-none gap-[2px] p-0">
          {view.vaults.map((v) => {
            const current = v.id === view.vaultId;
            return (
              <li
                key={v.id}
                className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-[13px]"
              >
                <span className="truncate">{v.name}</span>
                {v.id === "personal" && (
                  <span className={badge}>Predefinito</span>
                )}
                {!v.exists && <span className={badge}>Nuovo</span>}
                <span className="ml-auto flex items-center gap-[4px]">
                  {current ? (
                    <>
                      <span className={badge}>Attivo</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        aria-label={`Rinomina “${v.name}”`}
                        disabled={busy}
                        onClick={onRename}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        type="button"
                        aria-label={`Elimina “${v.name}”`}
                        title={deleteBlock || undefined}
                        disabled={busy || !!deleteBlock}
                        onClick={() => setConfirming(true)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
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
            );
          })}
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
          Rinomina ed elimina agiscono sul vault attivo. Si elimina solo un
          vault vuoto e mai il Personale.
        </p>
      </section>
      {remembered !== null && (
        <section className={card}>
          <h3 className={cardTitle}>Sblocco · {view.vaultName}</h3>
          <Row
            label="Ricorda su questo dispositivo"
            hint="La chiave resta nel portachiavi di sistema: all’avvio il vault si apre senza password. “Blocca vault” la richiede comunque finché non riavvii l’app."
          >
            <Switch
              label="Ricorda su questo dispositivo"
              checked={remembered}
              onChange={onRemember}
            />
          </Row>
        </section>
      )}
      <section className={card}>
        <h3 className={cardTitle}>Sincronizzazione · {view.vaultName}</h3>
        <p className={muted}>
          La sync è opzionale. Host, identità e chiavi vengono sincronizzati
          insieme, cifrati.
          {view.syncConfigured &&
            lastSync &&
            ` Ultima sincronizzazione riuscita: ${lastSync}.`}
        </p>
        <form
          className="mt-[10px] grid gap-[6px]"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveSync();
          }}
        >
          <label className="grid gap-[6px] text-[13px]">
            URL servizio
            <Input
              required
              type="url"
              placeholder="https://sync.example.com"
              value={syncUrl}
              onChange={(e) => onSyncUrl(e.target.value)}
            />
          </label>
          <p className={help}>
            {view.vaultId === "personal"
              ? "Il vault Personale conserva l’endpoint compatibile /vault."
              : `Inserendo l’indirizzo del servizio verrà usato /vaults/${view.vaultId}. Per collegare un altro dispositivo copia l’URL completo dopo il salvataggio.`}
          </p>
          <label className="grid gap-[6px] text-[13px]">
            Token
            <PasswordInput
              autoComplete="off"
              required={!view.syncConfigured}
              minLength={syncToken ? 32 : undefined}
              placeholder={
                view.syncConfigured
                  ? "Vuoto per mantenere il token esistente"
                  : "Almeno 32 caratteri"
              }
              value={syncToken}
              onChange={(e) => onSyncToken(e.target.value)}
            />
          </label>
          <p className={help}>
            Controllo ogni 30 secondi a vault sbloccato. In caso di modifiche
            concorrenti, la sync si ferma e conserva i dati locali.
          </p>
          <div className="flex justify-end gap-[8px]">
            {view.syncConfigured && (
              <Button
                variant="ghost"
                type="button"
                disabled={busy || syncing}
                onClick={onSyncNow}
              >
                <RefreshCw size={14} />
                Sincronizza ora
              </Button>
            )}
            <Button variant="default" type="submit" disabled={busy}>
              Salva configurazione
            </Button>
          </div>
        </form>
      </section>
      {confirming && (
        <Panel
          variant="alert"
          title="Eliminare il vault?"
          busy={busy}
          error=""
          onClose={() => setConfirming(false)}
        >
          <AlertDialogDescription>
            «{view.vaultName}» è vuoto e verrà rimosso. Tornerai al vault
            Personale e le sessioni aperte verranno chiuse.
          </AlertDialogDescription>
          <footer>
            <Button
              variant="ghost"
              type="button"
              data-alert-cancel
              onClick={() => setConfirming(false)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Elimina
            </Button>
          </footer>
        </Panel>
      )}
    </div>
  );
}
