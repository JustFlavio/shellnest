import { DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Identity, IdentityForm, View } from "@/lib/types";
import { IdentityAccessSection } from "./IdentityAccessSection";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";

const identityIsDirty = (value: IdentityForm, existing: Identity | undefined) =>
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
  return (
    <Panel
      title={existing ? "Modifica identità" : "Nuova identità"}
      {...{ onClose, busy, error }}
      dirty={identityIsDirty(value, existing)}
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
        <IdentityAccessSection
          value={value}
          onChange={onChange}
          keys={view.keys}
          existing={existing}
          onNewKey={onNewKey}
        />
      </form>
    </Panel>
  );
}
