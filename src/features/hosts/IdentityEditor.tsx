import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { stripWhitespace } from "@/lib/input-text";
import type { Identity, IdentityForm, View } from "@/lib/types";
import { IdentityAccessSection } from "./IdentityAccessSection";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";
import { IdentitySharing } from "@/features/vault/SharingNotices";
import { FieldErrors } from "@/components/FieldErrors";
import { TextField } from "@/components/TextField";
import { useFormErrors } from "@/lib/useFormErrors";
import { identityFormErrors } from "./form-checks.ts";

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
  errorField,
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
  errorField: string;
}) {
  const { t } = useTranslation();
  const existing = view.identities.find((i) => i.id === value.id);
  const form = useFormErrors(
    value.id,
    identityFormErrors(value, !!existing?.hasPassword),
    ["name", "username", "key", "password"],
    error,
    errorField,
  );
  return (
    <Panel
      title={
        existing
          ? t("hosts.identityEditor.editIdentity")
          : t("hosts.identityEditor.newIdentity")
      }
      backLabel={returnTo ? t("hosts.groupEditor.backToHost") : undefined}
      {...{ onClose, busy }}
      error={form.banner}
      dirty={identityIsDirty(value, existing)}
      footer={
        <footer>
          <Button
            variant="default"
            type="submit"
            form="identity-editor-form"
            className="primary"
            disabled={busy}
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
              placeholder={t("hosts.identityEditor.eGAdministration")}
            />
            <TextField
              name="username"
              label={t("hosts.collectionTables.sshUser")}
              required
              value={value.username}
              onChange={(e) =>
                onChange({
                  ...value,
                  username: stripWhitespace(e.target.value),
                })
              }
              placeholder="root"
              autoComplete="off"
            />
          </EditorSection>
          <IdentityAccessSection
            value={value}
            onChange={onChange}
            keys={view.keys}
            existing={existing}
            onNewKey={onNewKey}
          />
          <IdentitySharing identityId={value.id} />
        </FieldErrors>
      </form>
    </Panel>
  );
}
