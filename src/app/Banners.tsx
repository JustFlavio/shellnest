import { useTranslation } from "react-i18next";
import { useApp } from "./app-context";
import { Check } from "lucide-react";

export function NoticeBanner() {
  const {
    vault: { notice },
  } = useApp();
  if (!notice) return null;
  return (
    <div
      className="flex shrink-0 items-center gap-[10px] px-[22px] py-[10px] text-[13px] border-b border-success/15 bg-success/7 text-success"
      role="status"
    >
      <Check size={14} />
      {notice}
    </div>
  );
}

export function PreviewBanner() {
  const { t } = useTranslation();
  return (
    <div className="border-b border-warning/12 bg-warning/6 px-[22px] py-[6px] text-[12px] text-warning">
      {t("app.banners.interactivePreviewUsesSample")}
    </div>
  );
}
