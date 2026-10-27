import { Combobox } from "@base-ui/react/combobox";
import { Folder, FolderPlus, FolderX } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { groupOptions, groupPath, inheritedIdentity } from "./groups.mjs";
import type { Group, HostDraft } from "@/lib/types";
import {
  fieldIcon,
  sheetField,
  suggestion,
  suggestionEmpty,
  suggestions,
  suggestionsPositioner,
} from "@/lib/editor-ui";

type Item = {
  key: string;
  kind: "group" | "create" | "none";
  label: string;
  id?: string;
  name?: string;
};

// Folder picker for a host: filters existing folders while typing and offers to create a new
// one, which opens the folder sheet instead of silently inventing a name.
export function GroupField({
  value,
  groups,
  onChange,
  onNewGroup,
}: {
  value: HostDraft;
  groups: Group[];
  onChange: (value: HostDraft) => void;
  onNewGroup: (name: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selectedPath = value.groupId ? groupPath(groups, value.groupId) : "";
  const text = (query ?? "").trim();
  const lowered = text.toLowerCase();
  const options = groupOptions(groups);
  const exact = options.some(
    (o) =>
      o.group.name.toLowerCase() === lowered ||
      o.path.toLowerCase() === lowered,
  );
  // Matches come first so Enter picks an existing folder; creating one is the last resort.
  const items: Item[] = [
    ...options
      .filter((o) => !lowered || o.path.toLowerCase().includes(lowered))
      .map((o) => ({
        key: o.group.id,
        kind: "group" as const,
        label: o.path,
        id: o.group.id,
      })),
    ...(text && !exact
      ? [
          {
            key: "create",
            kind: "create" as const,
            label: `Crea cartella “${text}”`,
            name: text,
          },
        ]
      : []),
    ...(value.groupId && !text
      ? [{ key: "none", kind: "none" as const, label: "Nessuna cartella" }]
      : []),
  ];
  const selected: Item | null = value.groupId
    ? {
        key: value.groupId,
        kind: "group",
        label: selectedPath,
        id: value.groupId,
      }
    : null;
  // Picking a folder that supplies an identity switches a host without its own credentials to it.
  const pick = (groupId: string) => {
    const ownCredentials =
      !!value.identityId ||
      !!value.credentials?.username ||
      !!value.credentials?.password;
    onChange({
      ...value,
      groupId,
      inheritIdentity: ownCredentials
        ? value.inheritIdentity && !!inheritedIdentity(groups, groupId)
        : !!inheritedIdentity(groups, groupId),
    });
  };
  return (
    <Combobox.Root<Item>
      items={items}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery(null);
      }}
      value={selected}
      inputValue={query ?? selectedPath}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.key === b.key}
      filter={null}
      autoHighlight
      openOnInputClick
      onInputValueChange={(next, details) => {
        if (
          details.reason === "input-change" ||
          details.reason === "input-clear"
        )
          setQuery(next);
      }}
      onValueChange={(item) => {
        if (!item) return;
        setQuery(null);
        if (item.kind === "create") onNewGroup(item.name ?? "");
        else pick(item.kind === "none" ? "" : (item.id ?? ""));
      }}
    >
      <div
        className={cn("relative [&_[data-slot=input]]:pl-[38px]", sheetField)}
      >
        <Folder className={fieldIcon} aria-hidden="true" />
        <Combobox.Input
          render={<Input />}
          aria-label="Cartella"
          autoComplete="off"
          placeholder="Cartella (facoltativa)"
        />
      </div>
      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={6}
          align="start"
          className={suggestionsPositioner}
        >
          <Combobox.Popup className={suggestions}>
            <Combobox.List>
              {(item: Item) => (
                <Combobox.Item
                  key={item.key}
                  value={item}
                  className={suggestion}
                >
                  {item.kind === "create" ? (
                    <FolderPlus aria-hidden="true" />
                  ) : item.kind === "none" ? (
                    <FolderX aria-hidden="true" />
                  ) : (
                    <Folder aria-hidden="true" />
                  )}
                  <span>
                    <strong>{item.label}</strong>
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
            {!items.length && (
              <p className={suggestionEmpty}>
                Nessuna cartella. Scrivi un nome per crearne una.
              </p>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
