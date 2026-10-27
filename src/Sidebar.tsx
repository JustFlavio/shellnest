import { NavItem } from "./NavItem";
import { ancestry, childGroups } from "./groups.mjs";
import { cn } from "./lib/utils";
import { Folder, KeyRound, Server, UserRound } from "lucide-react";
import { useApp } from "./app-context";
import { VaultSwitcher } from "./VaultSwitcher";
import { pageLabels } from "./useLibrary";
import type { Page } from "./useLibrary";

export function Sidebar() {
  const {
    vault: { view },
    tabs: { active },
    library: { page, group, navigate, showFolder, groupHostCount },
  } = useApp();
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col border-r border-border bg-sidebar px-[10px] pt-[14px] max-[760px]:px-[8px] max-[760px]:pt-[12px]",
        active !== "vault" && "hidden",
      )}
    >
      <VaultSwitcher />
      <nav aria-label="Navigazione principale">
        {(["hosts", "identities", "keys"] as Page[]).map((p) => {
          const Icon =
            p === "hosts" ? Server : p === "identities" ? UserRound : KeyRound;
          return (
            <NavItem
              key={p}
              icon={<Icon size={16} />}
              label={pageLabels[p]}
              count={
                p === "hosts"
                  ? view.hosts.length
                  : p === "identities"
                    ? view.identities.length
                    : view.keys.length
              }
              active={page === p && active === "vault"}
              aria-label={pageLabels[p]}
              title={pageLabels[p]}
              onClick={() => navigate(p)}
            />
          );
        })}
      </nav>
      {view.groups.length > 0 && (
        <nav
          className="mt-[24px] min-h-0 overflow-y-auto max-[760px]:hidden"
          aria-label="Cartelle host"
        >
          <h2 className="px-[11px] pb-[8px] text-[12px] text-muted-foreground">
            Cartelle
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
                aria-label={`Cartella ${g.name}`}
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
