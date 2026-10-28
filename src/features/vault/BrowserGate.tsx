import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { callout } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

export function BrowserGate() {
  const { t } = useTranslation();
  const {
    vault: { startPreview },
  } = useApp();
  return (
    <>
      <div className={callout}>{t("vault.browserGate.inMemorySampleData")}</div>
      <Button
        variant="default"
        type="button"
        className="mt-[8px] h-[40px] w-full"
        onClick={startPreview}
      >
        {t("vault.browserGate.exploreTheInterface")}
      </Button>
    </>
  );
}
