import { useTranslation } from "react-i18next";
import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        "group/tab relative flex h-[34px] w-[220px] max-w-[260px] min-w-[160px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[10px] border border-transparent bg-sidebar pr-[6px] pl-[6px] text-[13px] whitespace-nowrap text-muted-foreground transition-colors motion-reduce:transition-none",
        "hover:bg-card hover:text-foreground focus-within:text-foreground",
        selected && "bg-foreground/15 text-foreground hover:bg-foreground/15",
        !fixed && "max-[760px]:w-[160px] max-[760px]:min-w-[140px]",
        fixed && "w-auto min-w-0 pr-[12px]",
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
}: {
  icon: ReactNode;
  onClose?: () => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const swap = "group-hover/tab:hidden group-data-[selected]/tab:hidden";
  return (
    <Button
      variant="ghost"
      type="button"
      aria-label={
        onClose ? t("terminal.tab.closeName", { name: label }) : undefined
      }
      tabIndex={onClose ? 0 : -1}
      onClick={onClose}
      className={cn(
        "relative grid size-[26px] flex-none place-items-center rounded-[6px] bg-transparent p-0 text-inherit hover:bg-transparent",
        onClose && "hover:bg-accent",
      )}
    >
      <span className={cn("grid place-items-center", onClose && swap)}>
        {icon}
      </span>
      {onClose && (
        <X
          size={14}
          className="hidden group-hover/tab:block group-data-[selected]/tab:block"
        />
      )}
    </Button>
  );
}

export function TabMain({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant">) {
  return (
    <Button
      variant="ghost"
      type="button"
      className={cn(
        "h-full min-w-0 flex-1 shrink justify-start overflow-hidden rounded-[5px] bg-transparent px-[4px] py-0 text-[13px] text-inherit hover:bg-transparent hover:text-inherit",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
    </Button>
  );
}

export const tabRenameClass =
  "ml-[8px] h-[24px] min-w-0 flex-1 rounded-[5px] border border-primary bg-background px-[6px] font-[inherit] text-foreground outline-none";
