import { useTranslation } from "react-i18next";
import { ChevronsUpDown, Plus, Pencil, LockKeyhole } from "lucide-react";
import type { View } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const newBadge = "text-[12px] text-muted-foreground";

export function VaultPicker({
  view,
  busy,
  disabled,
  onSelect,
  onCreate,
  onRename,
}: {
  view: View;
  busy: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="mb-[8px] flex w-full items-center gap-[9px] rounded-lg border border-border bg-card p-[8px] text-left text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-65 data-popup-open:bg-accent max-[760px]:justify-center max-[760px]:p-[6px] [&>svg]:shrink-0 [&>svg]:text-muted-foreground max-[760px]:[&>svg]:hidden"
        aria-label={t("vault.vaultPicker.activeVaultName", {
          name: view.vaultName,
        })}
        disabled={busy || disabled}
      >
        <span className="grid size-[28px] shrink-0 place-items-center rounded-[6px] border border-input text-muted-foreground">
          <LockKeyhole size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[2px] max-[760px]:hidden">
          <small className="text-[12px] text-muted-foreground">
            {t("vault.vaultList.vault")}
          </small>
          <span className="truncate text-[13px] font-medium">
            {view.vaultName}
          </span>
        </span>
        {!view.exists && (
          <span className={newBadge + " max-[760px]:hidden"}>
            {t("vault.vaultList.new")}
          </span>
        )}
        <ChevronsUpDown size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64" align="start" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("vault.vaultPicker.yourVaults")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={view.vaultId}
            onValueChange={(id) => {
              if (id !== view.vaultId) onSelect(id);
            }}
          >
            {view.vaults.map((vault) => (
              <DropdownMenuRadioItem
                key={vault.id}
                value={vault.id}
                closeOnClick
              >
                <LockKeyhole size={14} />
                <span className="truncate">{vault.name}</span>
                {!vault.exists && (
                  <span className={newBadge}>{t("vault.vaultList.new")}</span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate}>
          <Plus size={14} />
          {t("vault.vaultList.newVault")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil size={14} />
          {t("vault.vaultPanels.renameVault")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
