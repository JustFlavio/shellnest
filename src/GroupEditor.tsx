import { DialogClose } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import { Input } from "./components/ui/input";
import { SelectField } from "./SelectField";
import { EditorSection, Panel } from "./Editors";
import {
  depthOf,
  groupOptions,
  MAX_GROUP_DEPTH,
  subtreeIds,
} from "./groups.mjs";
import type { GroupForm, View } from "./types";
import { portInline, sectionHelp, sheetField } from "./editor-ui";

const ROOT = "__root";
const NONE = "__none";

// Create or edit a folder: its name, where it sits and the identity and port its hosts default to.
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
      title={existing ? "Modifica gruppo" : "Nuovo gruppo"}
      {...{ onClose, busy, error }}
      dirty={dirty}
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
            form="group-editor-form"
            className="primary"
            disabled={busy || !value.name.trim() || invalidName}
          >
            {returnTo ? "Salva e torna all’host" : "Salva gruppo"}
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
        <EditorSection title="Generale">
          <label className={sheetField}>
            <span className="sr-only">Nome</span>
            <Input
              autoFocus
              required
              maxLength={80}
              value={value.name}
              aria-invalid={invalidName || undefined}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Nome del gruppo"
            />
          </label>
          <div className={sheetField}>
            <SelectField
              aria-label="Gruppo padre"
              value={value.parentId || ROOT}
              onValueChange={(next) =>
                onChange({ ...value, parentId: next === ROOT ? "" : next })
              }
              options={[
                { value: ROOT, label: "Nessun gruppo padre" },
                ...parents.map((o) => ({ value: o.group.id, label: o.path })),
              ]}
            />
          </div>
        </EditorSection>
        <EditorSection title="Predefiniti per gli host">
          <p className={sectionHelp}>
            Gli host del gruppo, e dei suoi sottogruppi, li usano quando non
            hanno un valore proprio.
          </p>
          <div className={sheetField}>
            <SelectField
              aria-label="Identità predefinita"
              value={value.identityId || NONE}
              onValueChange={(next) =>
                onChange({ ...value, identityId: next === NONE ? "" : next })
              }
              options={[
                { value: NONE, label: "Nessuna identità predefinita" },
                ...view.identities.map((i) => ({
                  value: i.id,
                  label: `${i.name} — ${i.username}`,
                })),
              ]}
            />
          </div>
          <label className={cn(portInline, "mt-[10px] text-[12px]")}>
            Porta SSH
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
