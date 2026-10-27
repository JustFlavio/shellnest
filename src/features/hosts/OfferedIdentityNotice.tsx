import { ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Group, HostDraft, Identity } from "@/lib/types";
import { groupPath } from "./groups.mjs";
import { inheritedBox } from "@/lib/editor-ui";

export function OfferedIdentityNotice({
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
        Il gruppo <strong>{groupPath(groups, folder.id)}</strong> offre
        l’identità <strong>{identity?.name ?? "—"}</strong>.
      </span>
      <Button
        variant="ghost"
        type="button"
        className="shrink-0 text-[12px] text-primary"
        onClick={() =>
          onChange({
            ...value,
            inheritIdentity: true,
            identityId: "",
            credentials: { username: "", password: "" },
          })
        }
      >
        Usala
      </Button>
    </div>
  );
}
