import { ChevronsUpDown, Plus, Pencil, LockKeyhole } from "lucide-react";
import type { View } from "./types";
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
} from "./components/ui/dropdown-menu";

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="vault-picker"
        aria-label={"Vault attivo: " + view.vaultName}
        disabled={busy || disabled}
      >
        <span className="vault-picker-icon">
          <LockKeyhole size={16} />
        </span>
        <span className="vault-picker-name">
          <small>Vault</small>
          <span>{view.vaultName}</span>
        </span>
        {!view.exists && <span className="vault-new">Nuovo</span>}
        <ChevronsUpDown size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64" align="start" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>I tuoi vault</DropdownMenuLabel>
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
                {!vault.exists && <span className="vault-new">Nuovo</span>}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate}>
          <Plus size={14} />
          Nuovo vault
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil size={14} />
          Rinomina vault
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
