import { useTranslation } from "react-i18next";
import {
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { LauncherIcon } from "./LauncherIcon";
import type { LauncherResult } from "./launcher-results.ts";

const titles = {
  hosts: "hosts.hostsView.hosts",
  tabs: "hosts.vaultToolbar.cards",
  quick: "hosts.vaultHeader.quickConnect",
} as const;
const order = ["hosts", "tabs", "quick"] as const;

// The menu under the search box. Rows are picked from the search box's keys; a click opens a
// row at once. Mouse down must not take focus from the search box.
export function SearchMenu({
  results,
  cursor,
  jump,
  jumpShortcut,
  empty,
  busy,
  onJump,
  onActivate,
}: {
  results: LauncherResult[];
  cursor: number;
  jump: boolean;
  jumpShortcut: string;
  // why no host or tab is listed
  empty: string | null;
  busy: boolean;
  onJump: () => void;
  onActivate: (result: LauncherResult) => void;
}) {
  const { t } = useTranslation();
  const groups = order.flatMap((id) => {
    const items = results.flatMap((result, index) =>
      result.group === id ? [{ result, index }] : [],
    );
    return items.length ? [{ id, items }] : [];
  });
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- keeps focus in the search box; the rows below are the interactive elements
    <div
      data-search-menu
      className="absolute inset-x-0 top-[46px] z-20 max-h-[min(440px,calc(100dvh-160px))] overflow-auto rounded-[12px] border border-border bg-sidebar p-[8px] shadow-[0_16px_40px_#0006]"
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        aria-pressed={jump}
        className={cn(
          "mb-[6px] inline-flex h-[28px] items-center gap-[8px] rounded-full border border-border px-[12px] text-[12px] text-muted-foreground hover:text-foreground",
          jump && "border-primary/60 text-foreground",
        )}
        onClick={onJump}
      >
        {t("settings.shortcuts.goToTab")}
        {jumpShortcut && <kbd className="font-normal">{jumpShortcut}</kbd>}
      </button>
      <CommandList
        label={t("terminal.searchMenu.searchResults")}
        className="max-h-none"
      >
        {groups.map(({ id, items }, n) => (
          <div key={id}>
            {n > 0 && <CommandSeparator className="mx-0 my-[6px]" />}
            <CommandGroup
              heading={t(titles[id])}
              className="p-0 **:[[cmdk-group-heading]]:px-[8px] **:[[cmdk-group-heading]]:py-[7px] **:[[cmdk-group-heading]]:text-[12px]"
            >
              {items.map(({ result, index }) => (
                <CommandItem
                  key={result.key}
                  value={`menu-${result.key}`}
                  disabled={busy}
                  data-launch-selected={index === cursor ? "" : undefined}
                  className={cn(
                    "h-[38px] gap-[11px] rounded-[8px] px-[8px] text-[13px]",
                    index === cursor &&
                      "bg-[color-mix(in_oklab,var(--primary)_20%,var(--accent))]",
                  )}
                  onSelect={() => onActivate(result)}
                >
                  <LauncherIcon result={result} />
                  <span className="min-w-0 flex-1 truncate">
                    {result.title}
                  </span>
                  <span className="shrink-0 text-[12px] font-normal text-muted-foreground">
                    {result.path}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
        {empty && (
          <p className="px-[8px] py-[10px] text-[13px] text-muted-foreground">
            {empty}
          </p>
        )}
      </CommandList>
    </div>
  );
}
