import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Textarea } from "@/components/ui/textarea";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { KeyForm, View } from "@/lib/types";
import { callout, fingerprint, help, sectionHelp } from "@/lib/editor-ui";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";

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
  const file = useRef<HTMLInputElement>(null);
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
            {returnTo
              ? "Importa e torna all’identità"
              : existing
                ? "Salva chiave"
                : "Importa chiave"}
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
        {returnTo && (
          <p className={help}>
            Importa la chiave da usare per questa identità. Il modulo precedente
            conserva i dati già inseriti.
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
              placeholder="Es. Chiave personale"
            />
          </label>
          {existing && (
            <>
              <label>
                Impronta pubblica
                <code className={fingerprint}>
                  {existing.fingerprint ||
                    "Non verificata: reimporta la chiave per validarla"}
                </code>
              </label>
              <p className={sectionHelp}>
                Usata da {existing.identityCount} identità e{" "}
                {existing.hostCount} host. Per rinominare la chiave, lascia
                vuoti i campi qui sotto.
              </p>
            </>
          )}
        </EditorSection>
        <EditorSection title="Chiave privata">
          <input
            ref={file}
            type="file"
            tabIndex={-1}
            className="sr-only"
            aria-label="File della chiave privata"
            onChange={async (e) => {
              setFileError("");
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 1024 * 1024)
                  throw new Error("File troppo grande (massimo 1 MB)");
                const text = await f.text();
                onChange({
                  ...value,
                  privateKey: text,
                  name: value.name || f.name,
                });
              } catch (err) {
                setFileError(String(err));
              }
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            type="button"
            onClick={() => file.current?.click()}
          >
            <Upload size={15} />
            Scegli file della chiave privata
          </Button>
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
            La chiave viene importata nel vault cifrato. Il file originale non
            viene modificato.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
