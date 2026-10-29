import { useTranslation } from "react-i18next";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/features/hosts/Panel";
import { pasteLineCount } from "./terminal-input.ts";

const PREVIEW_CHARS = 600;

export function PasteConfirmDialog({
  text,
  onConfirm,
  onCancel,
}: {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Panel
      variant="alert"
      title={t("terminal.pasteConfirmDialog.pasteMultipleLines")}
      busy={false}
      error=""
      onClose={onCancel}
    >
      <AlertDialogDescription>
        {t("terminal.pasteConfirmDialog.aboutToPaste", {
          count: pasteLineCount(text),
        })}
      </AlertDialogDescription>
      <pre className="max-h-[160px] overflow-auto rounded-[10px] bg-muted p-[14px] text-left font-mono text-[12px] whitespace-pre-wrap [overflow-wrap:anywhere]">
        {text.slice(0, PREVIEW_CHARS)}
        {text.length > PREVIEW_CHARS && "…"}
      </pre>
      <footer>
        <Button
          type="button"
          variant="outline"
          data-alert-cancel
          onClick={onCancel}
        >
          {t("vault.deleteVaultDialog.cancel")}
        </Button>
        <Button type="button" onClick={onConfirm}>
          {t("terminal.pasteConfirmDialog.paste")}
        </Button>
      </footer>
    </Panel>
  );
}
