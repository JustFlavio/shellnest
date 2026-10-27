import type { ReactNode } from "react";

const row =
  "flex items-center justify-between gap-[16px] border-t border-border py-[11px] first:border-t-0 text-[13px]";

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={row}>
      <div className="min-w-0">
        <div>{label}</div>
        {hint && (
          <div className="mt-[2px] text-[12px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
