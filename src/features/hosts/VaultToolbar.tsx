import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { groupOptions } from "./groups.ts";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ChevronDown,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Plus,
  TerminalSquare,
} from "lucide-react";
import { useApp } from "@/app/app-context";

const filterTrigger =
  "h-[30px] gap-[7px] border-input bg-card pr-[8px] pl-[10px] text-[12px] hover:border-[color-mix(in_srgb,var(--primary)_40%,var(--input))] hover:bg-accent [&>svg:first-child]:text-muted-foreground";

export function VaultToolbar() {
  const {
    vault: { view, busy, preview },
    preferences: { hint },
    tabs: { openLocal },
    library: {
      page,
      group,
      sort,
      setSort,
      layout,
      changeLayout,
      openGroup,
      newFolder,
      createNew,
    },
  } = useApp();
  return (
    <div className="mt-[14px] flex shrink-0 items-center gap-[8px] border-b border-border px-[22px] pb-[14px] max-[1100px]:px-[18px] max-[760px]:flex-wrap">
      <div className="inline-flex items-stretch">
        <Button
          variant="default"
          type="button"
          className={cn(
            "h-[30px] bg-clip-border focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/60",
            page === "hosts" && "rounded-r-none",
          )}
          disabled={busy}
          onClick={createNew}
          title={page === "hosts" ? hint("newHost") || undefined : undefined}
        >
          <Plus size={15} />
          {page === "hosts"
            ? "Nuovo host"
            : page === "identities"
              ? "Nuova identità"
              : "Importa chiave"}
        </Button>
        {page === "hosts" && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="default"
                  type="button"
                  className="h-[30px] w-[28px] rounded-l-none bg-clip-border px-0 shadow-[inset_1px_0_0_rgb(0_0_0/0.22)] aria-expanded:brightness-110 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/60"
                />
              }
              aria-label="Altre azioni di creazione"
              disabled={busy}
            >
              <ChevronDown size={15} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem onClick={createNew}>
                <Plus size={14} />
                Nuovo host
                <DropdownMenuShortcut>{hint("newHost")}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={newFolder}>
                <FolderPlus size={14} />
                Nuova cartella
                <DropdownMenuShortcut>{hint("newFolder")}</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {page === "hosts" && (
        <Button
          variant="ghost"
          type="button"
          className="h-[30px] gap-[6px] px-[10px] text-muted-foreground max-[760px]:w-[30px] max-[760px]:text-[0px]"
          disabled={busy || preview}
          onClick={openLocal}
        >
          <TerminalSquare size={16} />
          Terminale locale
        </Button>
      )}
      <span className="flex-1 max-[760px]:min-w-[20px]" />
      {page === "hosts" && (
        <>
          <SelectField
            className={cn(filterTrigger, "hidden w-[160px] max-[760px]:flex")}
            icon={<Folder size={14} />}
            aria-label="Filtra per cartella"
            placeholder="Tutte le cartelle"
            value={group}
            onValueChange={openGroup}
            options={[
              { value: "", label: "Tutte le cartelle" },
              ...groupOptions(view.groups).map((o) => ({
                value: o.group.id,
                label: o.path,
              })),
            ]}
          />
          <SelectField
            className={cn(filterTrigger, "w-auto min-w-[150px]")}
            icon={<ArrowUpDown size={14} />}
            aria-label="Ordina host"
            value={sort}
            onValueChange={(value) => setSort(value as "name" | "recent")}
            options={[
              { value: "name", label: "Nome A–Z" },
              { value: "recent", label: "Ultimo accesso" },
            ]}
          />
          <div
            className="flex items-center gap-[2px] rounded-[6px] border border-border p-[2px]"
            role="group"
            aria-label="Visualizzazione host"
          >
            <Button
              variant="ghost"
              type="button"
              className="h-[26px] w-[27px] rounded-[4px] p-0 text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
              title="Schede"
              aria-label="Schede"
              aria-pressed={layout === "cards"}
              onClick={() => changeLayout("cards")}
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="h-[26px] w-[27px] rounded-[4px] p-0 text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
              title="Lista"
              aria-label="Lista"
              aria-pressed={layout === "list"}
              onClick={() => changeLayout("list")}
            >
              <List size={17} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
