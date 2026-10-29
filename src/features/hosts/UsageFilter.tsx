import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useApp } from "@/app/app-context";

export function UsageFilter() {
  const { t } = useTranslation();
  const {
    library: { page, usage, clearUsage },
  } = useApp();
  if (!usage || page !== "hosts") return null;
  return (
    <div className="mx-[22px] mt-[12px] flex shrink-0 items-center gap-[10px] rounded-[7px] border border-input bg-card px-[10px] py-[6px] text-[12px]">
      {t("hosts.usageFilter.hostsLinkedTo")} <strong>{usage.label}</strong>
      <Button
        variant="ghost"
        type="button"
        aria-label={t("hosts.usageFilter.removeIdentityFilter")}
        className="ml-auto size-[25px] p-0"
        onClick={clearUsage}
      >
        <X size={14} />
      </Button>
    </div>
  );
}
