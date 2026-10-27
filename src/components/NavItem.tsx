import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sidebar row: icon, label and count; collapses to the icon on narrow windows.
export function NavItem({
  icon,
  label,
  count,
  active,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children" | "variant"> & {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Button
      variant="ghost"
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(
        "my-[2px] h-[40px] w-full justify-start gap-[10px] rounded-[7px] px-[11px] text-left text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground max-[760px]:justify-center max-[760px]:px-0 [&>svg]:shrink-0 [&>svg]:opacity-80",
        active &&
          "bg-[color-mix(in_srgb,var(--primary)_12%,var(--sidebar))] text-primary hover:bg-[color-mix(in_srgb,var(--primary)_12%,var(--sidebar))] hover:text-primary [&>svg]:opacity-100",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate max-[760px]:hidden">{label}</span>
      <span className="ml-auto text-[12px] tabular-nums max-[760px]:hidden">
        {count}
      </span>
    </Button>
  );
}
