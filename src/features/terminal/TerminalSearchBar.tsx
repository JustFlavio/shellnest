import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useTerminalSearch } from "./useTerminalSearch";

export function TerminalSearchBar({
  search: { query, change, noMatch, input, find, close },
}: {
  search: ReturnType<typeof useTerminalSearch>;
}) {
  const { t } = useTranslation();
  return (
    <search className="absolute top-[48px] right-[20px] z-10 flex items-center gap-[4px] rounded-[10px] border border-border bg-card p-[4px] shadow-lg">
      <Input
        ref={input}
        value={query}
        placeholder={t("terminal.terminalSearchBar.searchInTheTerminal")}
        aria-label={t("terminal.terminalSearchBar.searchInTheTerminal")}
        aria-invalid={noMatch || undefined}
        className="h-[30px] w-[200px]"
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          } else if (e.key === "Enter") {
            e.preventDefault();
            find(!e.shiftKey);
          }
        }}
      />
      <Button
        variant="ghost"
        type="button"
        size="icon-sm"
        aria-label={t("terminal.terminalSearchBar.previousResult")}
        onClick={() => find(false)}
      >
        <ChevronUp size={15} />
      </Button>
      <Button
        variant="ghost"
        type="button"
        size="icon-sm"
        aria-label={t("terminal.terminalSearchBar.nextResult")}
        onClick={() => find(true)}
      >
        <ChevronDown size={15} />
      </Button>
      <Button
        variant="ghost"
        type="button"
        size="icon-sm"
        aria-label={t("terminal.terminalSearchBar.closeSearch")}
        onClick={close}
      >
        <X size={15} />
      </Button>
    </search>
  );
}
