import { DialogClose } from "@/components/ui/dialog";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Plus } from "lucide-react";
import type { IdentityForm, View } from "@/lib/types";
import { callout, help, sectionHelp } from "@/lib/editor-ui";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";

export function IdentityEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewKey,
  returnTo,
  busy,
  error,
}: {
  value: IdentityForm;
  onChange: (v: IdentityForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  onNewKey: () => void;
  returnTo?: string;
  busy: boolean;
  error: string;
}) {
  const existing = view.identities.find((i) => i.id === value.id);
  const dirty =
    !!value.password ||
    (existing
      ? (["name", "username", "auth", "keyId"] as const).some(
          (key) => value[key] !== existing[key],
        )
      : !!(
          value.name ||
          value.keyId ||
          value.username !== "root" ||
          value.auth !== "key"
        ));
  return (
    <Panel
      title={existing ? "Modifica identità" : "Nuova identità"}
      {...{ onClose, busy, error }}
      dirty={dirty}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo ? "Torna all’host" : "Annulla"}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="identity-editor-form"
            className="primary"
            disabled={busy || (value.auth === "key" && !value.keyId)}
          >
            {returnTo ? "Salva e torna all’host" : "Salva identità"}
          </Button>
        </footer>
      }
    >
      <form
        id="identity-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {returnTo && (
          <p className={help}>
            Stai preparando l’accesso per un nuovo host. Dopo il salvataggio
            tornerai al modulo host, con i dati già inseriti.
          </p>
        )}
        <EditorSection title="Generale">
          <label>
            Nome
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Es. Amministrazione"
            />
          </label>
          <label>
            Utente SSH
            <Input
              required
              value={value.username}
              onChange={(e) => onChange({ ...value, username: e.target.value })}
              placeholder="root"
              autoComplete="off"
            />
          </label>
        </EditorSection>
        <EditorSection title="Accesso SSH">
          <label>
            Metodo
            <SelectField
              aria-label="Metodo di autenticazione"
              value={value.auth}
              onValueChange={(auth) =>
                onChange({
                  ...value,
                  auth: auth as "key" | "password",
                  password: "",
                  keyId: "",
                })
              }
              options={[
                { value: "key", label: "Chiave SSH" },
                { value: "password", label: "Password" },
              ]}
            />
          </label>
          {value.auth === "key" ? (
            <>
              <label>
                Chiave dal portachiavi
                <SelectField
                  aria-label="Chiave dal portachiavi"
                  required
                  value={value.keyId}
                  onValueChange={(keyId) => onChange({ ...value, keyId })}
                  placeholder="Seleziona una chiave"
                  options={view.keys.map((k) => ({
                    value: k.id,
                    label: k.name,
                  }))}
                />
              </label>
              <Button
                variant="link"
                className="mt-[10px]"
                type="button"
                onClick={onNewKey}
              >
                <Plus size={14} />
                Importa una chiave
              </Button>
            </>
          ) : (
            <label>
              Password
              <PasswordInput
                autoComplete="new-password"
                required={!existing?.hasPassword}
                value={value.password}
                onChange={(e) =>
                  onChange({ ...value, password: e.target.value })
                }
                placeholder={
                  existing?.hasPassword
                    ? "Lascia vuoto per mantenere quella salvata"
                    : ""
                }
              />
            </label>
          )}
          {existing && existing.hostCount > 0 && (
            <div className={callout}>
              La modifica verrà usata dalle prossime connessioni di{" "}
              {existing.hostCount} host. Le sessioni già aperte restano attive.
            </div>
          )}
          <p className={sectionHelp}>
            Puoi assegnare questa identità a uno o più host. Identità con utenti
            diversi possono usare la stessa chiave.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
