import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      data-slot="input"
      className={cn(
        "h-[36px] w-full min-w-0 rounded-[7px] border border-input bg-field px-[10px] py-[8px] text-[13px] text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 caret-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
