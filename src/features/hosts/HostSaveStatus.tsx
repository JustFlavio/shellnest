import { Check, Pencil, LoaderCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

export function HostSaveStatus({ status }: { status: SaveStatus }) {
  const StatusIcon =
    status === "saving"
      ? LoaderCircle
      : status === "saved"
        ? Check
        : status === "error"
          ? AlertCircle
          : Pencil;
  const label =
    status === "saving"
      ? "Salvataggio in corso"
      : status === "saved"
        ? "Salvato"
        : status === "error"
          ? "Salvataggio non riuscito"
          : "Modifiche non salvate";
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
      <StatusIcon
        className={`size-4 ${status === "saving" ? "animate-spin" : ""}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
