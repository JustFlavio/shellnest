import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HostDraft, View } from "@/lib/types";
import { groupPath, portSource } from "./groups.mjs";
import { portInline, sectionHelp } from "@/lib/editor-ui";

export function HostPortField({
  value,
  view,
  onChange,
}: {
  value: HostDraft;
  view: View;
  onChange: (v: HostDraft) => void;
}) {
  const portFrom = portSource(view.groups, value.groupId);
  return (
    <>
      <label className={cn(portInline, "m-0! text-[14px]! font-semibold")}>
        Porta SSH
        <Input
          type="number"
          min={1}
          max={65535}
          value={value.ownPort ?? ""}
          placeholder={String(portFrom?.port ?? 22)}
          onChange={(e) =>
            onChange({
              ...value,
              ownPort: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
      {value.ownPort === null && portFrom && (
        <p className={sectionHelp}>
          Porta ereditata dal gruppo {groupPath(view.groups, portFrom.id)}.
        </p>
      )}
    </>
  );
}
