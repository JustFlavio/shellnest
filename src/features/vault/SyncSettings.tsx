import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { card, cardTitle } from "@/features/settings/settings-ui";
import { help, muted } from "@/lib/editor-ui";
import type { View } from "@/lib/types";

export function SyncSettings({
  view,
  busy,
  syncUrl,
  syncToken,
  syncing,
  lastSync,
  onSyncUrl,
  onSyncToken,
  onSave,
  onSyncNow,
}: {
  view: View;
  busy: boolean;
  syncUrl: string;
  syncToken: string;
  syncing: boolean;
  lastSync: string;
  onSyncUrl: (url: string) => void;
  onSyncToken: (token: string) => void;
  onSave: () => void;
  onSyncNow: () => void;
}) {
  return (
    <section className={card}>
      <h3 className={cardTitle}>Sincronizzazione · {view.vaultName}</h3>
      <p className={muted}>
        Host, identità e chiavi, cifrati.
        {view.syncConfigured &&
          lastSync &&
          ` Ultima sincronizzazione riuscita: ${lastSync}.`}
      </p>
      <form
        className="mt-[10px] grid gap-[6px]"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
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
            ? "Percorso: /vault"
            : `Verrà usato /vaults/${view.vaultId}. Per un altro dispositivo copia l’URL completo dopo il salvataggio.`}
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
          Ogni 30 s a vault sbloccato. Con modifiche concorrenti la sync si
          ferma e conserva i dati locali.
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
  );
}
