import { createElement, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import type { useCloseGuard } from "@/features/terminal/CloseGuard";
import { useLatest } from "@/lib/useLatest";
import { desktop } from "@/lib/platform";
import { updater } from "@/lib/updater";
import type { PendingUpdate } from "@/lib/updater";
import { UpdateProgress } from "./UpdateProgress";
import {
  LAUNCH_CHECK_DELAY_MS,
  isBusy,
  percentOf,
  updateFailure,
} from "./update-flow.ts";
import type { UpdateStatus } from "./update-flow.ts";
import pkg from "../../../package.json";

// One toast carries the whole flow, so each step replaces the previous one instead of stacking.
const TOAST = "app-update";
// Sent by the macOS app menu (src-tauri/src/menu.rs).
const MENU_EVENT = "check-for-updates";

// An action click would dismiss the toast; the next step replaces it in place instead.
const action = (label: string, run: () => void) => ({
  label,
  onClick: (event: { preventDefault: () => void }) => {
    event.preventDefault();
    run();
  },
});

/**
 * Looks for a new version shortly after launch (quietly) or on request, downloads it and,
 * only on the user's click, installs it and restarts. Every step is a toast with one action.
 */
export function useAppUpdate(
  checkOnLaunch: boolean,
  hasLiveSessions: () => boolean,
  closeGuard: ReturnType<typeof useCloseGuard>,
) {
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });
  const pending = useRef<PendingUpdate | null>(null);
  const downloaded = useRef(false);
  const busy = useRef(false);
  const live = useLatest(hasLiveSessions);
  const guard = useLatest(closeGuard);

  const failed = (title: string, error: unknown, retry: () => void) => {
    toast.error(`${title}: ${updateFailure(error)}`, {
      id: TOAST,
      duration: 8000,
      action: action("Riprova", retry),
    });
  };

  const offerRestart = (version: string) => {
    downloaded.current = true;
    setStatus({ kind: "ready", version });
    toast.success("Aggiornamento pronto", {
      id: TOAST,
      duration: Infinity,
      description: `Riavvia per passare a Shellnest ${version}.`,
      action: action("Riavvia ora", restart),
    });
  };

  function restart() {
    const update = pending.current;
    if (!update || busy.current) return;
    const install = async () => {
      busy.current = true;
      setStatus({ kind: "installing", version: update.version });
      toast.loading("Installazione in corso…", {
        id: TOAST,
        duration: Infinity,
        dismissible: false,
      });
      try {
        await update.install();
        await updater.relaunch();
      } catch (error) {
        busy.current = false;
        offerRestart(update.version);
        failed("Installazione non riuscita", error, restart);
      }
    };
    guard.current.ask(live.current(), () => void install(), true);
  }

  async function download() {
    const update = pending.current;
    if (!update || busy.current) return;
    busy.current = true;
    const show = (percent: number | null) => {
      setStatus({ kind: "downloading", version: update.version, percent });
      toast.loading("Download dell’aggiornamento", {
        id: TOAST,
        duration: Infinity,
        dismissible: false,
        description: createElement(UpdateProgress, {
          version: update.version,
          percent,
        }),
      });
    };
    show(null);
    let shown: number | null = null;
    try {
      await update.download((done, total) => {
        const percent = percentOf(done, total);
        // One toast update per whole percent, not per network chunk.
        if (percent !== shown) show((shown = percent));
      });
      offerRestart(update.version);
    } catch (error) {
      setStatus({ kind: "available", version: update.version });
      failed("Download non riuscito", error, () => void download());
    } finally {
      busy.current = false;
    }
  }

  const announce = (update: PendingUpdate) => {
    setStatus({ kind: "available", version: update.version });
    toast("Aggiornamento disponibile", {
      id: TOAST,
      duration: Infinity,
      description: `Shellnest ${update.version} è pronto da scaricare.`,
      action: action("Scarica", () => void download()),
    });
  };

  const check = async (manual: boolean) => {
    if (busy.current) return;
    // A version found earlier is offered again instead of asking the server twice.
    if (pending.current) {
      if (manual) {
        if (downloaded.current) offerRestart(pending.current.version);
        else announce(pending.current);
      }
      return;
    }
    busy.current = true;
    setStatus({ kind: "checking" });
    if (manual) toast.loading("Controllo aggiornamenti…", { id: TOAST });
    try {
      const update = await updater.check();
      if (update) {
        pending.current = update;
        announce(update);
      } else {
        setStatus({ kind: "uptodate" });
        if (manual)
          toast.success("Nessun aggiornamento", {
            id: TOAST,
            duration: 4000,
            description: `Shellnest ${pkg.version} è l’ultima versione.`,
          });
      }
    } catch (error) {
      const message = updateFailure(error);
      setStatus({ kind: "error", message });
      // At launch a failure (no network, no release yet) is not worth a toast.
      if (manual)
        failed("Controllo non riuscito", error, () => void check(true));
    } finally {
      busy.current = false;
    }
  };

  const checkNow = useLatest(check);
  const launched = useRef(false);
  useEffect(() => {
    if (!checkOnLaunch || launched.current) return;
    const timer = setTimeout(() => {
      launched.current = true;
      void checkNow.current(false);
    }, LAUNCH_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [checkOnLaunch, checkNow]);
  useEffect(() => {
    if (!desktop) return;
    const unlisten = listen(MENU_EVENT, () => void checkNow.current(true));
    return () => void unlisten.then((off) => off());
  }, [checkNow]);

  return {
    status,
    busy: isBusy(status),
    check: () => void check(true),
    download: () => void download(),
    restart,
  };
}

export type AppUpdate = ReturnType<typeof useAppUpdate>;
