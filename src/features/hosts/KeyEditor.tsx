import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import type { ComponentProps } from "react";
import type { KeyForm, SshKey, View } from "@/lib/types";
import { fingerprint, sectionHelp } from "@/lib/editor-ui";
import { KeyFilePicker } from "./KeyFilePicker";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";
import { Alert } from "@/components/ui/alert";
import { FieldErrors, useFieldError } from "@/components/FieldErrors";
import { TextField } from "@/components/TextField";
import { useFormErrors } from "@/lib/useFormErrors";
import { keyFormErrors } from "./form-checks.ts";

const submitLabel = (
  t: TFunction,
  existing: SshKey | undefined,
  returnTo?: string,
) =>
  returnTo === "host"
    ? t("hosts.keyEditor.importAndBackToHost")
    : returnTo
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
  errorField,
  returnTo,
}: {
  value: KeyForm;
  onChange: (v: KeyForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  errorField: string;
  returnTo?: string;
}) {
  const { t } = useTranslation();
  const existing = view.keys.find((k) => k.id === value.id);
  const [fileError, setFileError] = useState("");
  const form = useFormErrors(
    value.id,
    keyFormErrors(value, !!existing),
    ["name", "privateKey"],
    error,
    errorField,
  );
  return (
    <Panel
      title={
        existing
          ? t("hosts.keyEditor.editSshKey")
          : t("hosts.keyEditor.importSshKey")
      }
      backLabel={
        returnTo === "host"
          ? t("hosts.groupEditor.backToHost")
          : returnTo
            ? t("hosts.keyEditor.backToIdentity")
            : undefined
      }
      {...{ onClose, busy }}
      error={fileError || form.banner}
      footer={
        <footer>
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
        noValidate
        onBlur={form.onBlur}
        onSubmit={(e) => {
          e.preventDefault();
          if (form.check(e.currentTarget)) onSubmit();
        }}
      >
        <FieldErrors errors={form.errors}>
          <EditorSection title={t("hosts.groupEditor.general")}>
            <TextField
              name="name"
              label={t("vault.vaultPanels.name")}
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t("hosts.keyEditor.eGPersonalKey")}
            />
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
            <PrivateKeyField
              label={
                existing
                  ? t("hosts.keyEditor.replacePrivateKeyOptional")
                  : t("hosts.keyEditor.privateKey")
              }

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
              <Alert className="mt-[12px]">
                {t("hosts.keyEditor.replacingTheKeyChanges")}
              </Alert>
            )}
            <p className={sectionHelp}>
              {t("hosts.keyEditor.importedIntoTheEncrypted")}
            </p>
          </EditorSection>
        </FieldErrors>
      </form>
    </Panel>
  );
}

// The private key text area with its field error; the explicit aria-label keeps the error out of the field name.
function PrivateKeyField({
  label,
  ...props
}: ComponentProps<typeof Textarea> & { label: string }) {
  const error = useFieldError("privateKey");
  return (
    <label {...error.field}>
      {label}
      <Textarea aria-label={label} {...props} {...error.control} />
      {error.message}
    </label>
  );
}
