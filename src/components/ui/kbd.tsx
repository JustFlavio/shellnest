import { cn } from "../../lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-[20px] w-fit min-w-[20px] items-center justify-center gap-1 rounded-[5px] bg-muted px-[5px] font-sans text-[11px] font-medium whitespace-nowrap text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
