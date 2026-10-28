import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { childGroups } from "./groups.ts";
import { Plus } from "lucide-react";
import { useApp } from "@/app/app-context";
import type { TFunction } from "i18next";
import type { Page } from "./useLibrary";

const createLabels = {
  hosts: "hosts.emptyState.addHost",
  identities: "hosts.emptyState.createIdentity",
  keys: "hosts.emptyState.importKey",
} as const;

function emptyTitle(
  t: TFunction,
  page: Page,
  group: string,
  filtered: boolean,
) {
  if (filtered) return t("hosts.emptyState.noResults");
  if (page === "hosts")
    return group
      ? t("hosts.emptyState.emptyFolder")
      : t("hosts.emptyState.noHosts");
  return page === "identities"
    ? t("hosts.emptyState.noIdentities")
    : t("hosts.emptyState.noSshKeys");
}

export function EmptyState() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    library: {
      page,
      group,
      query,
      usage,
      clearFilters,
      createNew,
      hostRows,
      identityRows,
      keyRows,
    },
  } = useApp();
  const empty =
    (page === "hosts" &&
      !hostRows.length &&
      !(!query.trim() && !usage && childGroups(view.groups, group).length)) ||
    (page === "identities" && !identityRows.length) ||
    (page === "keys" && !keyRows.length);
  if (!empty) return null;
  const filtered = !!(query || usage);
  return (
    <div className="empty flex flex-1 flex-col items-center justify-center px-[24px] pt-[24px] pb-[8vh] text-center text-muted-foreground [&_button]:border [&_button]:border-input [&_h2]:mb-[16px] [&_h2]:text-foreground">
      <h2>{emptyTitle(t, page, group, filtered)}</h2>
      {filtered ? (
        <Button variant="ghost" type="button" onClick={clearFilters}>
          {t("hosts.emptyState.clearFilters")}
        </Button>
      ) : (
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={createNew}
        >
          <Plus size={14} />
          {t(createLabels[page])}
        </Button>
      )}
    </div>
  );
}
