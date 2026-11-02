import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
/** The bar inside the download toast; without a known size it only shows the text. */
export function UpdateProgress({
  version,
  percent,
}: {
  version: string;
  percent: number | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-[6px]">
      <span>
        Shellnest {version}
        {percent !== null && ` · ${percent}%`}
      </span>
      {percent !== null && (
        <Progress
          value={percent}
          aria-label={t("settings.updateProgress.updateDownload")}
        />
      )}
    </div>
  );
}
