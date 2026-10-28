import { toast } from "sonner";
import { describeError, errorToastId } from "./error-message.ts";

export function notifyError(
  title: string,
  error: unknown,
  action?: { label: string; onClick: () => void },
) {
  const description = describeError(error);
  toast.error(title, {
    id: errorToastId(title, description),
    description,
    // Errors stay long enough to be read; sonner's default suits the short info toasts.
    duration: 8000,
    action,
  });
}
