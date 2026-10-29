import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tableClass = cn(
  "w-full border-separate border-spacing-0 text-left text-[13px]",
  "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-1",
  "[&_th]:h-[30px] [&_th]:border-b [&_th]:border-border [&_th]:bg-sidebar [&_th]:px-[12px] [&_th]:text-[12px] [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted-foreground",
  "[&_td]:h-[40px] [&_td]:border-b [&_td]:border-border [&_td]:px-[12px] [&_td]:py-[3px] [&_td]:align-middle [&_td]:whitespace-nowrap",
  "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr]:animate-[rise_0.28s_cubic-bezier(0.2,0.7,0.2,1)_backwards] [&_tbody_tr:hover]:bg-card",
  "[&_tbody_tr.checked]:bg-accent [&_tbody_tr.checked]:outline [&_tbody_tr.checked]:-outline-offset-1 [&_tbody_tr.checked]:outline-primary",
);

export function HostTable({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{t("vault.vaultPanels.name")}</th>
          <th>{t("hosts.hostEditor.address")}</th>
          <th>{t("hosts.hostTable.access")}</th>
          <th className="min-w-[88px] text-right">
            <span className="sr-only">
              {t("hosts.collectionTables.actions")}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
