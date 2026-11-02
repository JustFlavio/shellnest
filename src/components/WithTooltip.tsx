import type { ReactElement, ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Hover and focus label for a control. It is visual only: the control keeps its aria-label.
export function WithTooltip({
  label,
  shortcut,
  side,
  children,
}: {
  label: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
}) {
  if (!label) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
