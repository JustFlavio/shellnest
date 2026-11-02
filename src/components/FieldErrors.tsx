import { createContext, use, useId } from "react";
import type { ReactNode } from "react";
import { FieldError } from "@/components/ui/field";

// Field name → error text, set by an editor for the fields inside it.
const FieldErrorsContext = createContext<Partial<Record<string, string>>>({});

export function FieldErrors({
  errors,
  children,
}: {
  errors: Partial<Record<string, string>>;
  children: ReactNode;
}) {
  return <FieldErrorsContext value={errors}>{children}</FieldErrorsContext>;
}

/** The error of one field: `control` goes on its input, `message` under it, `field` on its wrapper (for blur tracking). */
export function useFieldError(name: string) {
  const id = useId();
  const text = use(FieldErrorsContext)[name] ?? "";
  return {
    field: { "data-field": name },
    control: text
      ? { "aria-invalid": true, "aria-describedby": id }
      : { "aria-invalid": undefined },
    message: text ? <FieldError id={id}>{text}</FieldError> : null,
  };
}

/** A wrapper for any control: `children` gets the props for the control, the error shows below it. */
export function FieldSlot({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: (control: ReturnType<typeof useFieldError>["control"]) => ReactNode;
}) {
  const error = useFieldError(name);
  return (
    <div className={className} {...error.field}>
      {children(error.control)}
      {error.message}
    </div>
  );
}
