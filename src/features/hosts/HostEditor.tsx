import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { LockKeyhole } from "lucide-react";
import { FieldErrors } from "@/components/FieldErrors";
import { TextField } from "@/components/TextField";
import type { HostDraft, View } from "@/lib/types";
import { hostDraftErrors, hostDraftIsDirty } from "./host-draft";
import { HostAddressField } from "./HostAddressField";
import { useFormErrors } from "@/lib/useFormErrors";
import { GroupField } from "./GroupField";
import { HostAccessSection } from "./HostAccessSection";
import { HostSaveStatus } from "./HostSaveStatus";
import type { SaveStatus } from "./HostSaveStatus";
import { sheetField, vaultBar } from "@/lib/editor-ui";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";
import { ReadOnlyNotice } from "@/features/vault/SharingNotices";
import { HostTagsField } from "./HostTagsField";

const HOST_FIELDS = [
  "name",
  "address",
  "port",
  "group",
  "tags",
  "identity",
  "username",
  "password",
  "key",
];

export function HostEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewIdentity,
  onNewKey,
  onNewGroup,
  busy,
  error,
  errorField,
  saveStatus,
  hasUnsavedChanges,
  onRetrySave,
  onRevealPassword,
}: {
  value: HostDraft;
  onChange: (v: HostDraft) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  onNewIdentity: () => void;
  onNewKey?: () => void;
  onNewGroup: (name: string) => void;
  busy: boolean;
  error: string;
  errorField: string;
  saveStatus?: SaveStatus;
  hasUnsavedChanges?: boolean;
  onRetrySave?: () => void;
  onRevealPassword?: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const existing = view.hosts.find((h) => h.id === value.id);
  const dirty = hasUnsavedChanges ?? hostDraftIsDirty(value, existing);
  const form = useFormErrors(
    value.id,
    hostDraftErrors(value, view.identities, existing, view.groups),
    HOST_FIELDS,
    error,
    errorField,
  );
  const valid = form.valid;
  return (
    <Panel
      className="host-editor"
      title={
        view.hosts.some((h) => h.id === value.id)
          ? t("hosts.hostEditor.editHost")
          : t("hosts.hostEditor.newHost")
      }
      {...{ onClose, busy }}
      error={form.banner}
      dirty={dirty && (!saveStatus || !valid)}
      status={
        saveStatus && saveStatus !== "idle" ? (
          <HostSaveStatus status={saveStatus} />
        ) : undefined
      }
      footer={
        <footer>
          {saveStatus === "error" && (
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={onRetrySave}
            >
              {t("vault.useVaultSync.retry")}
            </Button>
          )}
          <Button
            variant="default"
            type="submit"
            form="host-editor-form"
            className="primary"
            disabled={busy}
          >
            {t("hosts.hostEditor.connect")}
          </Button>
        </footer>
      }
    >
      <form
        id="host-editor-form"
        noValidate
        onBlur={form.onBlur}
        onSubmit={(e) => {
          e.preventDefault();
          if (form.check(e.currentTarget)) onSubmit();
        }}
      >
        <ReadOnlyNotice />
        <FieldErrors errors={form.errors}>
          <div
            className={vaultBar}
            aria-label={t("hosts.hostEditor.currentVault")}
          >
            <LockKeyhole className="size-5" aria-hidden="true" />
            <strong>{view.vaultName}</strong>
          </div>
          <EditorSection title={t("hosts.hostEditor.address")}>
            <HostAddressField value={value} view={view} onChange={onChange} />
          </EditorSection>
          <EditorSection title={t("hosts.groupEditor.general")}>
            <TextField
              name="name"
              label={t("vault.vaultPanels.name")}
              hideLabel
              className={sheetField}
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t("hosts.hostEditor.hostName")}
            />
            <GroupField
              value={value}
              groups={view.groups}
              onChange={onChange}
              onNewGroup={onNewGroup}
            />
            <HostTagsField
              value={value.tags ?? []}
              suggestions={[
                ...new Set(view.hosts.flatMap((host) => host.tags ?? [])),
              ].sort()}
              onChange={(tags) => onChange({ ...value, tags })}
            />
          </EditorSection>
          <HostAccessSection
            value={value}
            view={view}
            onChange={onChange}
            onNewIdentity={onNewIdentity}
            onNewKey={onNewKey}
            onRevealPassword={onRevealPassword}
          />
        </FieldErrors>
      </form>
    </Panel>
  );
}
