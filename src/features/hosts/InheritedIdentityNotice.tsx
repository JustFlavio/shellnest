import { useTranslation } from "react-i18next";
import { ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Group, HostDraft, Identity } from "@/lib/types";
import { groupPath } from "./groups.ts";
import { inheritedBox } from "@/lib/editor-ui";

export function InheritedIdentityNotice({
  value,
  folder,
  identity,
  groups,
  onChange,
}: {
  value: HostDraft;
  folder: Group;
  identity: Identity | undefined;
  groups: Group[];
  onChange: (v: HostDraft) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={inheritedBox}>
      <ContactRound aria-hidden="true" />
      <span>
        t("hosts.bulkAssignDialog.identity"){" "}
        <strong>{identity?.name ?? "—"}</strong>
        {identity ? ` (${identity.username})` : ""} dal gruppo{" "}
        <strong>{groupPath(groups, folder.id)}</strong>
      </span>
      <Button
        variant="ghost"
        type="button"
        className="shrink-0 text-[12px] text-primary"
        onClick={() => onChange({ ...value, inheritIdentity: false })}
      >
        {t("hosts.inheritedIdentityNotice.useOwnCredentials")}
      </Button>
    </div>
  );
}
