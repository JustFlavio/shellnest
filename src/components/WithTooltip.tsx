import type { ReactElement, ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Whether the last input was the keyboard. WebKit treats the focus a dialog moves to its first
// button as :focus-visible even after a click, so Base UI would open that button's tooltip.
let keyboard = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => (keyboard = true), true);
  window.addEventListener("pointerdown", () => (keyboard = false), true);
}

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
    <Tooltip
      onOpenChange={(open, details) => {
        if (open && details.reason === "trigger-focus" && !keyboard)
          details.cancel();
      }}
    >
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
