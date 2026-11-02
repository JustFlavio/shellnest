import { cn } from "../../lib/utils";

// From shadcn's field, only the error line: the editors keep their own label layout.
function FieldError({ className, ...props }: React.ComponentProps<"div">) {
  if (!props.children) return null;
  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn(
        "mt-[6px] text-[12px] leading-[1.5] font-normal text-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { FieldError };
