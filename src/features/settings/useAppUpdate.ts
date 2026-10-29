import { useTranslation } from "react-i18next";
import { createElement, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  const { t } = useTranslation();
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
      action: action(t("vault.useVaultSync.retry"), retry),
    });
  };

  const offerRestart = (version: string) => {
    downloaded.current = true;
    setStatus({ kind: "ready", version });
    toast.success(t("settings.useAppUpdate.updateReady"), {
      id: TOAST,
      duration: Infinity,
      // Replaces the download progress; omitting it would keep the old one.
      description: null,
      action: action(t("settings.updateSettings.restartNow"), restart),
    });
  };

  function restart() {
    const update = pending.current;
    if (!update || busy.current) return;
    const install = async () => {
      busy.current = true;
      setStatus({ kind: "installing", version: update.version });
      toast.loading(t("settings.useAppUpdate.installing"), {
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
        failed(t("settings.useAppUpdate.installationFailed"), error, restart);
      }
    };
    guard.current.ask(live.current(), () => void install(), true);
  }

  async function download() {
    const update = pending.current;
    if (!update || busy.current) return;
    if (update.manualUrl)
      return void invoke("open_url", { url: update.manualUrl }).catch(() => {});
    busy.current = true;
    const show = (percent: number | null) => {
      setStatus({ kind: "downloading", version: update.version, percent });
      toast.loading(t("settings.updateProgress.updateDownload"), {
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
      failed(
        t("settings.useAppUpdate.downloadFailed"),
        error,
        () => void download(),
      );
    } finally {
      busy.current = false;
    }
  }

  const announce = (update: PendingUpdate) => {
    setStatus({ kind: "available", version: update.version });
    toast(t("settings.useAppUpdate.updateAvailable"), {
      id: TOAST,
      duration: Infinity,
      description: `Shellnest ${update.version}`,
      action: action(
        t("settings.updateSettings.download"),
        () => void download(),
      ),
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
    if (manual)
      toast.loading(t("settings.useAppUpdate.checkingForUpdates"), {
        id: TOAST,
      });
    try {
      const update = await updater.check();
      if (update) {
        pending.current = update;
        announce(update);
      } else {
        setStatus({ kind: "uptodate" });
        if (manual)
          toast.success(t("settings.useAppUpdate.noUpdates"), {
            id: TOAST,
            duration: 4000,
          });
      }
    } catch (error) {
      const message = updateFailure(error);
      setStatus({ kind: "error", message });
      // At launch a failure (no network, no release yet) is not worth a toast.
      if (manual)
        failed(
          t("settings.useAppUpdate.checkFailed"),
          error,
          () => void check(true),
        );
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
