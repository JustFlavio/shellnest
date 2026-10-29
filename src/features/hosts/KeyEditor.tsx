import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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

const submitLabel = (
  t: TFunction,
  existing: SshKey | undefined,
  returnTo?: string,
) =>
  returnTo
    ? t("hosts.keyEditor.importAndBackTo")
    : existing
      ? t("hosts.keyEditor.saveKey")
      : t("hosts.emptyState.importKey");

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
  const { t } = useTranslation();
  const existing = view.keys.find((k) => k.id === value.id);
  const [fileError, setFileError] = useState("");
  return (
    <Panel
      title={
        existing
          ? t("hosts.keyEditor.editSshKey")
          : t("hosts.keyEditor.importSshKey")
      }
      {...{ onClose, busy }}
      error={fileError || error}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo
              ? t("hosts.keyEditor.backToIdentity")
              : t("vault.deleteVaultDialog.cancel")}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="key-editor-form"
            className="primary"
            disabled={busy}
          >
            {submitLabel(t, existing, returnTo)}
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
        <EditorSection title={t("hosts.groupEditor.general")}>
          <label>
            {t("vault.vaultPanels.name")}
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t("hosts.keyEditor.eGPersonalKey")}
            />
          </label>
          {existing && (
            <>
              <div className="mt-[10px] flex flex-col gap-[7px] text-[12px] text-muted-foreground">
                {t("hosts.collectionTables.publicFingerprint")}
                <code className={fingerprint}>
                  {existing.fingerprint ||
                    t("hosts.keyEditor.notVerifiedImportThe")}
                </code>
              </div>
              <p className={sectionHelp}>
                {t("hosts.keyEditor.usedBy", {
                  identities: t("common.identityCount", {
                    count: existing.identityCount,
                  }),
                  hosts: t("common.hostCount", { count: existing.hostCount }),
                })}
              </p>
            </>
          )}
        </EditorSection>
        <EditorSection title={t("hosts.keyEditor.privateKey")}>
          <KeyFilePicker
            value={value}
            onChange={onChange}
            onError={setFileError}
          />
          <label>
            {existing
              ? t("hosts.keyEditor.replacePrivateKeyOptional")
              : t("hosts.keyEditor.privateKey")}
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
            {t("hosts.keyEditor.keyPassphrase")}
            <PasswordInput
              autoComplete="new-password"
              value={value.passphrase}
              onChange={(e) =>
                onChange({ ...value, passphrase: e.target.value })
              }
              disabled={!!existing && !value.privateKey}
              placeholder={t("hosts.keyEditor.ifTheKeyIs")}
            />
          </label>
          {existing && value.privateKey && (
            <div className={callout}>
              {t("hosts.keyEditor.replacingTheKeyChanges")}
            </div>
          )}
          <p className={sectionHelp}>
            {t("hosts.keyEditor.importedIntoTheEncrypted")}
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
