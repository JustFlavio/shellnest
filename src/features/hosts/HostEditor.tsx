import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Server, LockKeyhole } from "lucide-react";
import { OsIcon } from "@/components/OsIcon";
import type { HostDraft, View } from "@/lib/types";
import { hostDraftIsDirty, hostDraftIsValid } from "./host-draft";
import { GroupField } from "./GroupField";
import { HostAccessSection } from "./HostAccessSection";
import { HostSaveStatus } from "./HostSaveStatus";
import type { SaveStatus } from "./HostSaveStatus";
import { addressIcon, sheetField, vaultBar } from "@/lib/editor-ui";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";

export function HostEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewIdentity,
  onNewGroup,
  busy,
  error,
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
  onNewGroup: (name: string) => void;
  busy: boolean;
  error: string;
  saveStatus?: SaveStatus;
  hasUnsavedChanges?: boolean;
  onRetrySave?: () => void;
  onRevealPassword?: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const existing = view.hosts.find((h) => h.id === value.id);
  const dirty = hasUnsavedChanges ?? hostDraftIsDirty(value, existing);
  const valid = hostDraftIsValid(value, view.identities, existing, view.groups);
  return (
    <Panel
      className="host-editor"
      title={
        view.hosts.some((h) => h.id === value.id)
          ? t("hosts.hostEditor.editHost")
          : t("hosts.hostEditor.newHost")
      }
      {...{ onClose, busy, error }}
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
            disabled={busy || !valid}
          >
            {t("hosts.hostEditor.connect")}
          </Button>
        </footer>
      }
    >
      <form
        id="host-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div
          className={vaultBar}
          aria-label={t("hosts.hostEditor.currentVault")}
        >
          <LockKeyhole className="size-5" aria-hidden="true" />
          <strong>{view.vaultName}</strong>
        </div>
        <EditorSection title={t("hosts.hostEditor.address")}>
          <div className="flex items-center gap-[10px]">
            {value.os ? (
              <OsIcon os={value.os} size="field" />
            ) : (
              <span className={addressIcon}>
                <Server className="size-5" aria-hidden="true" />
              </span>
            )}
            <label className="m-0! min-w-0 flex-1">
              <span className="sr-only">{t("hosts.hostEditor.address")}</span>
              <Input
                required
                value={value.address}
                onChange={(e) =>
                  onChange({ ...value, address: e.target.value })
                }
                placeholder={t("hosts.hostEditor.ipOrHostName")}
              />
            </label>
          </div>
        </EditorSection>
        <EditorSection title={t("hosts.groupEditor.general")}>
          <label className={sheetField}>
            <span className="sr-only">{t("vault.vaultPanels.name")}</span>
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t("hosts.hostEditor.hostName")}
            />
          </label>
          <GroupField
            value={value}
            groups={view.groups}
            onChange={onChange}
            onNewGroup={onNewGroup}
          />
        </EditorSection>
        <HostAccessSection
          value={value}
          view={view}
          onChange={onChange}
          onNewIdentity={onNewIdentity}
          onRevealPassword={onRevealPassword}
        />
      </form>
    </Panel>
  );
}
