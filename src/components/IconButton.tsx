import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/WithTooltip";

// An icon-only button: the label is both its accessible name and its tooltip.
export function IconButton({
  label,
  tooltip = label,
  shortcut,
  side,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & {
  label: string;
  tooltip?: ReactNode;
  shortcut?: string;
  side?: ComponentProps<typeof WithTooltip>["side"];
}) {
  return (
    <WithTooltip label={tooltip} shortcut={shortcut} side={side}>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={label}
        {...props}
      />
    </WithTooltip>
  );
}
