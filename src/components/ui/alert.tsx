import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-[7px] border text-left has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-input bg-accent px-[12px] py-[11px] text-[12px] leading-[1.7] text-muted-foreground",
        destructive:
          "border-destructive/25 bg-destructive/5 p-[11px] text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// Errors are announced; the default variant is a plain note.
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : undefined}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Alert };
