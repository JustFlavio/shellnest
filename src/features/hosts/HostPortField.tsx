import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import type { HostDraft, View } from "@/lib/types";
import { groupPath, portSource } from "./groups.ts";

export function HostPortField({
  value,
  view,
  onChange,
}: {
  value: HostDraft;
  view: View;
  onChange: (v: HostDraft) => void;
}) {
  const { t } = useTranslation();
  const portFrom = portSource(view.groups, value.groupId);
  const inherited =
    value.ownPort === null && portFrom
      ? t("hosts.hostPortField.portInherited", {
          path: groupPath(view.groups, portFrom.id),
        })
      : undefined;
  return (
    <div className="w-[78px] shrink-0">
      <label className="m-0! w-[78px] shrink-0" title={inherited}>
        <span className="sr-only">{t("hosts.groupEditor.sshPort")}</span>
        <Input
          aria-label={t("hosts.groupEditor.sshPort")}
          aria-describedby={inherited ? `${value.id}-port-source` : undefined}
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
      {inherited && (
        <span id={`${value.id}-port-source`} className="sr-only">
          {inherited}
        </span>
      )}
    </div>
  );
}
