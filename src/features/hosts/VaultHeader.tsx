import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TerminalSquare } from "lucide-react";
import { useApp } from "@/app/app-context";
import { pageLabels } from "./useLibrary";

export function VaultHeader() {
  const { t } = useTranslation();
  const {
    vault: { view },
    preferences: { hint },
    tabs: { openLauncher },
    library: { page, group, hostRows, identityRows, keyRows },
  } = useApp();
  return (
    <header className="flex items-center gap-[16px] px-[22px] pt-[24px] max-[1100px]:px-[18px] max-[760px]:flex-wrap max-[760px]:gap-[8px] max-[760px]:pt-[12px]">
      <div className="flex min-w-0 flex-1 items-baseline gap-[10px]">
        <h1 className="overflow-hidden text-[22px] text-ellipsis whitespace-nowrap">
          {page === "hosts" && group
            ? (view.groups.find((g) => g.id === group)?.name ??
              t(pageLabels[page]))
            : t(pageLabels[page])}
        </h1>
        <span
          className="text-[12px] whitespace-nowrap text-muted-foreground"
          role="status"
        >
          {page === "hosts"
            ? hostRows.length
            : page === "identities"
              ? identityRows.length
              : keyRows.length}
        </span>
      </div>
      {page === "hosts" && (
        <Button
          variant="ghost"
          type="button"
          onClick={openLauncher}
          title={hint("quickConnect") || undefined}
        >
          <TerminalSquare size={15} />
          {t("hosts.vaultHeader.quickConnect")}
        </Button>
      )}
    </header>
  );
}
