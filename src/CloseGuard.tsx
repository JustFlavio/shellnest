import { useState } from "react";
import { Button } from "./components/ui/button";
import { AlertDialogDescription } from "./components/ui/alert-dialog";
import { Panel } from "./Editors";

export const CONFIRM_CLOSE_KEY = "shellnest.confirmClose";

export function confirmCloseEnabled() {
  try {
    return localStorage.getItem(CONFIRM_CLOSE_KEY) !== "off";
  } catch {
    return true;
  }
}
// Back to asking every time (for a future settings screen).
export function resetConfirmClose() {
  try {
    localStorage.removeItem(CONFIRM_CLOSE_KEY);
  } catch {}
}

// ask(live, run): runs `run` at once unless a connected session is about to be closed
// and the user did not opt out; then it shows the confirmation and runs it on "Interrompi".
export function useCloseGuard() {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [never, setNever] = useState(false);
  const cancel = () => {
    setPending(null);
    setNever(false);
  };
  return {
    open: pending !== null,
    ask: (live: boolean, run: () => void) => {
      if (live && confirmCloseEnabled()) setPending(() => run);
      else run();
    },
    dialog: pending && (
      <Panel
        variant="alert"
        title="Interrompere la sessione?"
        busy={false}
        error=""
        onClose={cancel}
      >
        <AlertDialogDescription>
          La sessione è ancora connessa: chiudendola verranno terminati i
          programmi in esecuzione nel terminale.
        </AlertDialogDescription>
        <div className="mt-[12px] flex items-center gap-[8px] text-[13px] text-muted-foreground">
          <input
            id="close-guard-never"
            type="checkbox"
            className="size-[16px] accent-primary"
            checked={never}
            onChange={(e) => setNever(e.target.checked)}
          />
          <label htmlFor="close-guard-never" className="cursor-pointer">
            Non chiedermelo più
          </label>
        </div>
        <footer>
          <Button
            type="button"
            variant="outline"
            data-alert-cancel
            onClick={cancel}
          >
            Annulla
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="danger"
            onClick={() => {
              if (never)
                try {
                  localStorage.setItem(CONFIRM_CLOSE_KEY, "off");
                } catch {}
              pending();
              cancel();
            }}
          >
            Interrompi
          </Button>
        </footer>
      </Panel>
    ),
  };
}
