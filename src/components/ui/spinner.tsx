import { cn } from "../../lib/utils";
import { Loader2Icon } from "lucide-react";

// Decorative: the surrounding status text says what is loading.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden
      className={cn("size-4 motion-safe:animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
