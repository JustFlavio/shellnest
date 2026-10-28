import { Trans } from "react-i18next";
import { useTranslation } from "react-i18next";
import { ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Group, HostDraft, Identity } from "@/lib/types";
import { groupPath } from "./groups.ts";
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
  const { t } = useTranslation();
  return (
    <div className={inheritedBox}>
      <ContactRound aria-hidden="true" />
      <span>
        <Trans
          i18nKey="hosts.offeredIdentityNotice.offers"
          values={{
            group: groupPath(groups, folder.id),
            identity: identity?.name ?? "—",
          }}
          components={{ strong: <strong /> }}
        />
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
        {t("hosts.offeredIdentityNotice.useIt")}
      </Button>
    </div>
  );
}
