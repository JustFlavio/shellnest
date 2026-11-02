import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Host } from "@/lib/types";
import { IconButton } from "@/components/IconButton";

export function HostEditButton({
  host,
  busy,
  floating = false,
  onEdit,
}: {
  host: Host;
  busy: boolean;
  floating?: boolean;
  onEdit: (host: Host) => void;
}) {
  const { t } = useTranslation();
  return (
    <IconButton
      label={t("hosts.collectionTables.editName", { name: host.name })}
      className={cn(
        "size-[30px] p-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        floating && "absolute inset-y-0 right-[8px] my-auto",
      )}
      disabled={busy}
      onClick={() => onEdit(host)}
    >
      <Pencil size={15} />
    </IconButton>
  );
}
