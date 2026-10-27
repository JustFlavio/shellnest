import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/features/hosts/Editors";
import { pasteLineCount } from "./terminal-input.mjs";

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
  return (
    <Panel
      variant="alert"
      title="Incollare più righe?"
      busy={false}
      error=""
      onClose={onCancel}
    >
      <AlertDialogDescription>
        Stai per incollare {pasteLineCount(text)} righe nel terminale. Ogni riga
        verrà eseguita dalla shell.
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
          Annulla
        </Button>
        <Button type="button" onClick={onConfirm}>
          Incolla
        </Button>
      </footer>
    </Panel>
  );
}
