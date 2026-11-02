import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WithTooltip } from "@/components/WithTooltip";

export function ActionMenu({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <WithTooltip label={label}>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex size-[28px] shrink-0 items-center justify-center rounded-[5px] p-0 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground",
            className,
          )}
          aria-label={label}
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent align="end" className="min-w-52" aria-label={label}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
