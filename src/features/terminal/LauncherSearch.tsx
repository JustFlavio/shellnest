import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function LauncherSearch({
  value,
  activeKey,
  shortcut,
  onChange,
  onKeyDown,
}: {
  value: string;
  // key of the highlighted result; undefined when there are none
  activeKey?: string;
  // formatted binding of the quick-connect shortcut; empty when unbound
  shortcut: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  return (
    <div className="mb-[20px] flex items-center gap-[10px] rounded-[9px] border border-input bg-field px-[12px] text-muted-foreground focus-within:border-ring">
      <Search size={16} />
      <Input
        className="h-[40px] min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 shadow-none outline-none focus-visible:border-0 focus-visible:outline-none"
        autoFocus
        aria-label="Cerca host o schede"
        placeholder="Cerca host o schede · ssh utente@host -p 22"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-controls="connection-results"
        aria-activedescendant={
          activeKey ? `connection-${activeKey}` : undefined
        }
        role="combobox"
        aria-expanded={!!activeKey}
        aria-autocomplete="list"
        onKeyDown={onKeyDown}
      />
      {shortcut && (
        <kbd className="text-[12px] whitespace-nowrap">{shortcut}</kbd>
      )}
    </div>
  );
}
