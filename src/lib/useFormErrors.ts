import { useState } from "react";
import type { FocusEvent } from "react";
import { useTranslation } from "react-i18next";

/**
 * The errors a form shows by field. `checks` (field → i18n key) are the instant client rules, shown once the
 * field lost focus or a submit was tried. A backend `error` naming one of `fields` goes under that field,
 * any other one stays in the banner.
 */
export function useFormErrors(
  formId: string,
  checks: Partial<Record<string, string>>,
  fields: readonly string[],
  error: string,
  errorField: string,
) {
  const { t } = useTranslation();
  const fresh = { formId, touched: new Set<string>(), all: false };
  const [state, setState] = useState(fresh);
  // A different record in the same editor starts clean.
  const current = state.formId === formId ? state : fresh;
  const errors: Partial<Record<string, string>> = {};
  for (const [field, key] of Object.entries(checks))
    if (key && (current.all || current.touched.has(field)))
      errors[field] = String(t(key as never));
  const own = !!error && fields.includes(errorField);
  if (own) errors[errorField] ??= error;
  const valid = Object.keys(checks).length === 0;
  return {
    errors,
    valid,
    banner: own ? "" : error,
    onBlur: (e: FocusEvent<HTMLFormElement>) => {
      const name = (e.target as Element)
        .closest("[data-field]")
        ?.getAttribute("data-field");
      if (name && !current.touched.has(name))
        setState({ ...current, touched: new Set(current.touched).add(name) });
    },
    /** True when the form can be sent; otherwise shows every error and focuses the first. */
    check: (form: HTMLFormElement) => {
      if (valid) return true;
      setState({ ...current, all: true });
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return false;
    },
  };
}
