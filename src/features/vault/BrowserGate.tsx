import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useApp } from "@/app/app-context";
import { Alert } from "@/components/ui/alert";

export function BrowserGate() {
  const { t } = useTranslation();
  const {
    vault: { startPreview },
  } = useApp();
  return (
    <>
      <Alert className="mt-[12px]">
        {t("vault.browserGate.inMemorySampleData")}
      </Alert>
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
