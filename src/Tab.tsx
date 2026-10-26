import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";

export type DropSide = "before" | "after";

export function StatusDot({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-[5px] shrink-0 rounded-full bg-[#d9ad58]",
        status === "connected" && "bg-[#76c5a0]",
        status === "closed" && "bg-muted-foreground",
        className,
      )}
    />
  );
}

// One tab of the bar: a hover surface that holds lead, label and action menu.
export function TabShell({
  selected,
  fixed,
  dragging,
  drop,
  className,
  ...props
}: ComponentProps<"div"> & {
  selected?: boolean;
  fixed?: boolean;
  dragging?: boolean;
  drop?: DropSide;
}) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "group/tab relative flex h-[34px] max-w-[280px] min-w-[140px] shrink-0 cursor-pointer items-center gap-[6px] rounded-[7px] border border-transparent pr-[3px] pl-[4px] text-[13px] whitespace-nowrap text-muted-foreground transition-colors",
        "hover:border-border hover:bg-accent/70 hover:text-foreground focus-within:border-border focus-within:bg-accent/70 focus-within:text-foreground",
        selected &&
          "border-input bg-card text-foreground shadow-[inset_0_-2px_var(--primary)] hover:border-input hover:bg-card focus-within:border-input focus-within:bg-card",
        fixed && "min-w-0",
        dragging && "opacity-45",
        drop &&
          "before:absolute before:inset-y-[4px] before:w-[2px] before:rounded-[1px] before:bg-primary before:content-['']",
        drop === "before" && "before:-left-[3px]",
        drop === "after" && "before:-right-[3px]",
        className,
      )}
      {...props}
    />
  );
}

// Left slot: the tab icon, swapped for a close X on hover and on the selected tab.
export function TabLead({
  icon,
  onClose,
  label = "",
  status,
}: {
  icon: ReactNode;
  onClose?: () => void;
  label?: string;
  status?: string;
}) {
  const swap = "group-hover/tab:hidden group-data-[selected]/tab:hidden";
  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={onClose ? `Chiudi ${label}` : undefined}
      tabIndex={onClose ? 0 : -1}
      onClick={onClose}
      className="relative grid size-[26px] flex-none place-items-center rounded-[6px] bg-transparent p-0 text-inherit hover:bg-transparent aria-label:hover:bg-accent"
    >
      <span
        className={cn(
          "grid place-items-center [&_.os-icon]:!size-[18px] [&_.os-icon]:!rounded-[4px] [&_.os-icon_svg]:!size-[12px]",
          onClose && swap,
        )}
      >
        {icon}
      </span>
      {onClose && (
        <X
          size={14}
          className="hidden group-hover/tab:block group-data-[selected]/tab:block"
        />
      )}
      {status && (
        <StatusDot
          status={status}
          className="absolute top-[1px] right-[1px] shadow-[0_0_0_2px_var(--header)]"
        />
      )}
    </Button>
  );
}

export function TabMain({
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant">) {
  return (
    <Button
      variant="ghost"
      type="button"
      className={cn(
        "h-full min-w-0 flex-1 justify-start overflow-hidden bg-transparent py-0 pr-[8px] pl-[4px] text-[13px] text-ellipsis text-inherit hover:bg-transparent hover:text-inherit",
        className,
      )}
      {...props}
    />
  );
}

export const tabRenameClass =
  "ml-[8px] h-[24px] min-w-0 flex-1 rounded-[5px] border border-primary bg-background px-[6px] font-[inherit] text-foreground outline-none";
