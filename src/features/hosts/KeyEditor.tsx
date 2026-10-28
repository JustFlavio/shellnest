import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import type { KeyForm, SshKey, View } from "@/lib/types";
import { callout, fingerprint, sectionHelp } from "@/lib/editor-ui";
import { KeyFilePicker } from "./KeyFilePicker";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";

const submitLabel = (existing: SshKey | undefined, returnTo?: string) =>
  returnTo
    ? "Importa e torna all’identità"
    : existing
      ? "Salva chiave"
      : "Importa chiave";

export function KeyEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  busy,
  error,
  returnTo,
}: {
  value: KeyForm;
  onChange: (v: KeyForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  returnTo?: string;
}) {
  const existing = view.keys.find((k) => k.id === value.id);
  const [fileError, setFileError] = useState("");
  return (
    <Panel
      title={existing ? "Modifica chiave SSH" : "Importa chiave SSH"}
      {...{ onClose, busy }}
      error={fileError || error}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo ? "Torna all’identità" : "Annulla"}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="key-editor-form"
            className="primary"
            disabled={busy}
          >
            {submitLabel(existing, returnTo)}
          </Button>
        </footer>
      }
      dirty={
        !!(
          value.privateKey ||
          value.passphrase ||
          value.name !== (existing?.name ?? "")
        )
      }
    >
      <form
        id="key-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <EditorSection title="Generale">
          <label>
            Nome
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Es. Chiave personale"
            />
          </label>
          {existing && (
            <>
              <div className="mt-[10px] flex flex-col gap-[7px] text-[12px] text-muted-foreground">
                Impronta pubblica
                <code className={fingerprint}>
                  {existing.fingerprint ||
                    "Non verificata: reimporta la chiave per validarla"}
                </code>
              </div>
              <p className={sectionHelp}>
                Usata da {existing.identityCount} identità e{" "}
                {existing.hostCount} host.
              </p>
            </>
          )}
        </EditorSection>
        <EditorSection title="Chiave privata">
          <KeyFilePicker
            value={value}
            onChange={onChange}
            onError={setFileError}
          />
          <label>
            {existing
              ? "Sostituisci chiave privata (opzionale)"
              : "Chiave privata"}
            <Textarea
              rows={9}
              spellCheck={false}
              autoComplete="off"
              required={!existing}
              value={value.privateKey}
              onChange={(e) =>
                onChange({ ...value, privateKey: e.target.value })
              }
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </label>
          <label>
            Passphrase della chiave
            <PasswordInput
              autoComplete="new-password"
              value={value.passphrase}
              onChange={(e) =>
                onChange({ ...value, passphrase: e.target.value })
              }
              disabled={!!existing && !value.privateKey}
              placeholder="Se la chiave è protetta"
            />
          </label>
          {existing && value.privateKey && (
            <div className={callout}>
              Sostituire la chiave modifica le prossime connessioni di tutte le
              identità che la utilizzano.
            </div>
          )}
          <p className={sectionHelp}>
            Importata nel vault cifrato; il file originale resta intatto.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
