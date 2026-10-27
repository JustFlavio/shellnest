import { CommandInput } from "@/components/ui/command";
import { InputGroupAddon } from "@/components/ui/input-group";

export function LauncherSearch({
  value,
  shortcut,
  placeholder,
  onChange,
  onKeyDown,
}: {
  value: string;
  // formatted binding of the quick-connect shortcut; empty when unbound
  shortcut: string;
  placeholder: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  return (
    <CommandInput
      wrapperClassName="p-0"
      groupClassName="mb-[20px] h-auto! gap-[10px] rounded-[9px]! border-input bg-field px-[12px] text-muted-foreground focus-within:border-ring dark:bg-field *:data-[slot=input-group-addon]:p-0! [&_svg]:size-[16px] [&_svg]:opacity-100"
      className="h-[40px] min-w-0 flex-1 px-0! text-[14px] placeholder:text-muted-foreground caret-primary"
      autoFocus
      autoCapitalize="off"
      placeholder={placeholder}
      value={value}
      onValueChange={onChange}
      onKeyDown={onKeyDown}
    >
      {shortcut && (
        <InputGroupAddon align="inline-end">
          <kbd className="text-[12px] font-normal whitespace-nowrap">
            {shortcut}
          </kbd>
        </InputGroupAddon>
      )}
    </CommandInput>
  );
}
