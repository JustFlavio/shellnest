import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Panel } from "@/features/hosts/Panel";

const CONFIRM_CLOSE_KEY = "shellnest.confirmClose";

function confirmCloseEnabled() {
  try {
    return localStorage.getItem(CONFIRM_CLOSE_KEY) !== "off";
  } catch {
    return true;
  }
}

// ask(live, run): runs `run` at once unless a connected session is about to be closed
// and the user did not opt out; then it shows the confirmation and runs it on "Interrompi".
// A restart for an update always asks while a session is live: "never ask again" is about closing tabs.
export function useCloseGuard() {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [restart, setRestart] = useState(false);
  const [never, setNever] = useState(false);
  const cancel = () => {
    setPending(null);
    setNever(false);
    setRestart(false);
  };
  return {
    open: pending !== null,
    ask: (live: boolean, run: () => void, forRestart = false) => {
      if (live && (forRestart || confirmCloseEnabled())) {
        setRestart(forRestart);
        setPending(() => run);
      } else run();
    },
    dialog: pending && (
      <Panel
        variant="alert"
        title={
          restart ? "Riavviare per aggiornare?" : "Interrompere la sessione?"
        }
        busy={false}
        error=""
        onClose={cancel}
      >
        <AlertDialogDescription>
          {restart
            ? "Ci sono sessioni ancora connesse: riavviando verranno chiuse e i programmi in esecuzione nei terminali terminati."
            : "La sessione è ancora connessa: chiudendola verranno terminati i programmi in esecuzione nel terminale."}
        </AlertDialogDescription>
        {!restart && (
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
        )}
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
              if (never && !restart)
                try {
                  localStorage.setItem(CONFIRM_CLOSE_KEY, "off");
                } catch {}
              pending();
              cancel();
            }}
          >
            {restart ? "Riavvia" : "Interrompi"}
          </Button>
        </footer>
      </Panel>
    ),
  };
}
