import { TerminalSquare } from "lucide-react";
import { cn } from "./lib/utils";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-[25px] shrink-0 place-items-center rounded-[6px] bg-primary text-primary-foreground [&>svg]:block",
        className,
      )}
    >
      <TerminalSquare size={18} />
    </span>
  );
}
