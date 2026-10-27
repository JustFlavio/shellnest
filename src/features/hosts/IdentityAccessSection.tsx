import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Plus } from "lucide-react";
import type { Identity, IdentityForm, SshKey } from "@/lib/types";
import { callout, sectionHelp } from "@/lib/editor-ui";
import { EditorSection } from "./EditorSection";

export function IdentityAccessSection({
  value,
  onChange,
  keys,
  existing,
  onNewKey,
}: {
  value: IdentityForm;
  onChange: (v: IdentityForm) => void;
  keys: SshKey[];
  existing: Identity | undefined;
  onNewKey: () => void;
}) {
  return (
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
              options={keys.map((k) => ({
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
            onChange={(e) => onChange({ ...value, password: e.target.value })}
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
  );
}
