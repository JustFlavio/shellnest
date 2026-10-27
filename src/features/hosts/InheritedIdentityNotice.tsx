import { ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Group, HostDraft, Identity } from "@/lib/types";
import { groupPath } from "./groups.mjs";
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
  return (
    <div className={inheritedBox}>
      <ContactRound aria-hidden="true" />
      <span>
        Identità <strong>{identity?.name ?? "—"}</strong>
        {identity ? ` (${identity.username})` : ""} dal gruppo{" "}
        <strong>{groupPath(groups, folder.id)}</strong>
      </span>
      <Button
        variant="ghost"
        type="button"
        className="shrink-0 text-[12px] text-primary"
        onClick={() => onChange({ ...value, inheritIdentity: false })}
      >
        Usa credenziali proprie
      </Button>
    </div>
  );
}
