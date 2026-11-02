import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { useFieldError } from "@/components/FieldErrors";

// A labelled input that shows its field error; the explicit aria-label keeps the error out of the field name.
export function TextField({
  name,
  label,
  hideLabel = false,
  className,
  ...input
}: ComponentProps<typeof Input> & {
  name: string;
  label: string;
  hideLabel?: boolean;
}) {
  const error = useFieldError(name);
  return (
    <label className={className} {...error.field}>
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <Input aria-label={label} {...input} {...error.control} />
      {error.message}
    </label>
  );
}
