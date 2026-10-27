import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useTerminalSearch } from "./useTerminalSearch";

export function TerminalSearchBar({
  search: { query, change, noMatch, input, find, close },
}: {
  search: ReturnType<typeof useTerminalSearch>;
}) {
  return (
    <search className="absolute top-[48px] right-[20px] z-10 flex items-center gap-[4px] rounded-[10px] border border-border bg-card p-[4px] shadow-lg">
      <Input
        ref={input}
        value={query}
        placeholder="Cerca nel terminale"
        aria-label="Cerca nel terminale"
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
        aria-label="Risultato precedente"
        onClick={() => find(false)}
      >
        <ChevronUp size={15} />
      </Button>
      <Button
        variant="ghost"
        type="button"
        size="icon-sm"
        aria-label="Risultato successivo"
        onClick={() => find(true)}
      >
        <ChevronDown size={15} />
      </Button>
      <Button
        variant="ghost"
        type="button"
        size="icon-sm"
        aria-label="Chiudi ricerca"
        onClick={close}
      >
        <X size={15} />
      </Button>
    </search>
  );
}
