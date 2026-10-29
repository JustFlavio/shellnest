import { useTranslation } from "react-i18next";
import { Check, Pencil, LoaderCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

const statuses = {
  saving: { Icon: LoaderCircle, label: "hosts.hostSaveStatus.saving" },
  saved: { Icon: Check, label: "hosts.hostSaveStatus.saved" },
  error: { Icon: AlertCircle, label: "hosts.hostSaveStatus.savingFailed" },
  idle: { Icon: Pencil, label: "hosts.hostSaveStatus.unsavedChanges" },
  editing: { Icon: Pencil, label: "hosts.hostSaveStatus.unsavedChanges" },
} as const;

export function HostSaveStatus({ status }: { status: SaveStatus }) {
  const { t } = useTranslation();
  const { Icon, label } = statuses[status];
  return (
    <span
      role="status"
      className={cn(
        "ml-auto inline-flex items-center text-muted-foreground",
        (status === "saving" || status === "saved") && "text-primary",
        status === "error" && "text-destructive",
      )}
      title={t(label)}
    >
      <Icon className={`size-4 ${status === "saving" ? "animate-spin" : ""}`} />
      <span className="sr-only">{t(label)}</span>
    </span>
  );
}
