import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/SelectField";
import { EditorSection } from "./EditorSection";
import { Panel } from "./Panel";
import {
  depthOf,
  groupOptions,
  MAX_GROUP_DEPTH,
  subtreeIds,
} from "./groups.ts";
import type { GroupForm, View } from "@/lib/types";
import { portInline, sectionHelp, sheetField } from "@/lib/editor-ui";

const ROOT = "__root";
const NONE = "__none";

export function GroupEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  returnTo,
  busy,
  error,
}: {
  value: GroupForm;
  onChange: (v: GroupForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  returnTo?: string;
  busy: boolean;
  error: string;
}) {
  const { t } = useTranslation();
  const existing = view.groups.find((g) => g.id === value.id);
  const dirty = existing
    ? (["name", "parentId", "identityId", "port"] as const).some(
        (key) => value[key] !== existing[key],
      )
    : !!(value.name || value.parentId || value.identityId || value.port);
  const parents = groupOptions(
    view.groups,
    "",
    new Set(existing ? subtreeIds(view.groups, existing.id) : []),
  ).filter((o) => depthOf(view.groups, o.group.id) < MAX_GROUP_DEPTH);
  const invalidName = /[/\x00-\x1f\x7f]/.test(value.name);
  return (
    <Panel
      title={
        existing
          ? t("hosts.folderCard.editGroup")
          : t("hosts.groupEditor.newGroup")
      }
      backLabel={returnTo ? t("hosts.groupEditor.backToHost") : undefined}
      {...{ onClose, busy, error }}
      dirty={dirty}
      footer={
        <footer>
          <Button
            variant="default"
            type="submit"
            form="group-editor-form"
            className="primary"
            disabled={busy || !value.name.trim() || invalidName}
          >
            {returnTo
              ? t("hosts.groupEditor.saveAndBackTo")
              : t("hosts.groupEditor.saveGroup")}
          </Button>
        </footer>
      }
    >
      <form
        id="group-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <EditorSection title={t("hosts.groupEditor.general")}>
          <label className={sheetField}>
            <span className="sr-only">{t("vault.vaultPanels.name")}</span>
            <Input
              autoFocus
              required
              maxLength={80}
              value={value.name}
              aria-invalid={invalidName || undefined}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t("hosts.groupEditor.groupName")}
            />
          </label>
          <div className={sheetField}>
            <SelectField
              aria-label={t("hosts.groupEditor.parentGroup")}
              value={value.parentId || ROOT}
              onValueChange={(next) =>
                onChange({ ...value, parentId: next === ROOT ? "" : next })
              }
              options={[
                { value: ROOT, label: t("hosts.groupEditor.noParentGroup") },
                ...parents.map((o) => ({ value: o.group.id, label: o.path })),
              ]}
            />
          </div>
        </EditorSection>
        <EditorSection title={t("hosts.groupEditor.hostDefaults")}>
          <p className={sectionHelp}>
            {t("hosts.groupEditor.inheritedByHostsAnd")}
          </p>
          <div className={sheetField}>
            <SelectField
              aria-label={t("hosts.groupEditor.defaultIdentity")}
              value={value.identityId || NONE}
              onValueChange={(next) =>
                onChange({ ...value, identityId: next === NONE ? "" : next })
              }
              options={[
                {
                  value: NONE,
                  label: t("hosts.groupEditor.noDefaultIdentity"),
                },
                ...view.identities.map((i) => ({
                  value: i.id,
                  label: `${i.name} — ${i.username}`,
                })),
              ]}
            />
          </div>
          <label className={cn(portInline, "mt-[10px] text-[12px]")}>
            {t("hosts.groupEditor.sshPort")}
            <Input
              type="number"
              min={1}
              max={65535}
              value={value.port ?? ""}
              placeholder="22"
              onChange={(e) =>
                onChange({
                  ...value,
                  port: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </EditorSection>
      </form>
    </Panel>
  );
}
