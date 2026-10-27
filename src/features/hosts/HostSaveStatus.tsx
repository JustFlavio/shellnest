import { Check, Pencil, LoaderCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

const statuses = {
  saving: { Icon: LoaderCircle, label: "Salvataggio in corso" },
  saved: { Icon: Check, label: "Salvato" },
  error: { Icon: AlertCircle, label: "Salvataggio non riuscito" },
  idle: { Icon: Pencil, label: "Modifiche non salvate" },
  editing: { Icon: Pencil, label: "Modifiche non salvate" },
} as const;

export function HostSaveStatus({ status }: { status: SaveStatus }) {
  const { Icon, label } = statuses[status];
  return (
    <span
      role="status"
      className={cn(
        "ml-auto inline-flex items-center text-muted-foreground",
        (status === "saving" || status === "saved") && "text-primary",
        status === "error" && "text-destructive",
      )}
      title={label}
    >
      <Icon className={`size-4 ${status === "saving" ? "animate-spin" : ""}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
