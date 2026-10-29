import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const existing = view.identities.find((i) => i.id === value.id);
  return (
    <Panel
      title={
        existing
          ? t("hosts.identityEditor.editIdentity")
          : t("hosts.identityEditor.newIdentity")
      }
      {...{ onClose, busy, error }}
      dirty={identityIsDirty(value, existing)}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo
              ? t("hosts.groupEditor.backToHost")
              : t("vault.deleteVaultDialog.cancel")}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="identity-editor-form"
            className="primary"
            disabled={busy || (value.auth === "key" && !value.keyId)}
          >
            {returnTo
              ? t("hosts.groupEditor.saveAndBackTo")
              : t("hosts.identityEditor.saveIdentity")}
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
        <EditorSection title={t("hosts.groupEditor.general")}>
          <label>
            {t("vault.vaultPanels.name")}
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t("hosts.identityEditor.eGAdministration")}
            />
          </label>
          <label>
            {t("hosts.collectionTables.sshUser")}
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
