import type { ComponentProps } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  required,
  disabled,
  ...props
}: Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      items={options}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger {...props}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
