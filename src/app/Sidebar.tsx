import { useTranslation } from "react-i18next";
import { NavItem } from "@/components/NavItem";
import { ancestry, childGroups } from "@/features/hosts/groups.ts";
import { cn } from "@/lib/utils";
import { Folder, KeyRound, Server, UserRound } from "lucide-react";
import { useApp } from "./app-context";
import { VaultSwitcher } from "@/features/vault/VaultSwitcher";
import { pageLabels } from "@/features/hosts/useLibrary";
import type { Page } from "@/features/hosts/useLibrary";

export function Sidebar() {
  const { t } = useTranslation();
  const {
    vault: { view },
    tabs: { active },
    library: { page, group, navigate, showFolder, groupHostCount, editing },
  } = useApp();
  return (
    <aside
      inert={active === "vault" && editing}
      aria-hidden={(active === "vault" && editing) || undefined}
      className={cn(
        "flex min-h-0 flex-col border-r border-border bg-sidebar px-[10px] pt-[14px] max-[760px]:px-[8px] max-[760px]:pt-[12px]",
        active !== "vault" && "hidden",
      )}
    >
      <VaultSwitcher />
      <nav aria-label={t("app.sidebar.mainNavigation")}>
        {(["hosts", "identities", "keys"] as Page[]).map((p) => {
          const Icon =
            p === "hosts" ? Server : p === "identities" ? UserRound : KeyRound;
          return (
            <NavItem
              key={p}
              icon={<Icon size={16} />}
              label={t(pageLabels[p])}
              count={
                p === "hosts"
                  ? view.hosts.length
                  : p === "identities"
                    ? view.identities.length
                    : view.keys.length
              }
              active={page === p && active === "vault"}
              aria-label={t(pageLabels[p])}
              title={t(pageLabels[p])}
              onClick={() => navigate(p)}
            />
          );
        })}
      </nav>
      {view.groups.length > 0 && (
        <nav
          className="mt-[24px] min-h-0 overflow-y-auto max-[760px]:hidden"
          aria-label={t("app.sidebar.hostFolders")}
        >
          <h2 className="px-[11px] pb-[8px] text-[12px] text-muted-foreground">
            {t("app.sidebar.folders")}
          </h2>
          {childGroups(view.groups, "").map((g) => {
            const current =
              page === "hosts" &&
              active === "vault" &&
              ancestry(view.groups, group).some((a) => a.id === g.id);
            return (
              <NavItem
                key={g.id}
                icon={<Folder size={15} />}
                label={g.name}
                count={groupHostCount(g.id)}
                active={current}
                aria-label={t("app.sidebar.folderName", { name: g.name })}
                title={g.name}
                onClick={() => showFolder(g.id)}
              />
            );
          })}
        </nav>
      )}
    </aside>
  );
}
