import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-y rounded-[7px] border border-input bg-field px-[10px] py-[8px] font-mono text-[14px] leading-[1.6] text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 caret-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
