import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { desktop } from "./platform";
import { previewUpdater } from "./preview/updater";

/** An update the server announced, before and after it is on disk. */
export type PendingUpdate = {
  version: string;
  download: (
    onProgress: (downloaded: number, total?: number) => void,
  ) => Promise<void>;
  /** Windows: this quits the app and the installer restarts it. macOS: call `relaunch` afterwards. */
  install: () => Promise<void>;
  /** Set when this install cannot replace itself (a Linux .deb): the page to download the new version from. */
  manualUrl?: string;
};

export type Updater = {
  check: () => Promise<PendingUpdate | null>;
  relaunch: () => Promise<void>;
};

const CHECK_TIMEOUT_MS = 15000;
const RELEASES_URL = "https://github.com/JustFlavio/shellnest/releases/latest";

const tauriUpdater: Updater = {
  async check() {
    const update = await check({ timeout: CHECK_TIMEOUT_MS });
    if (!update) return null;
    const manualUrl = (await invoke<boolean>("can_self_update"))
      ? undefined
      : RELEASES_URL;
    return {
      version: update.version,
      manualUrl,
      async download(onProgress) {
        let done = 0;
        let total: number | undefined;
        await update.download((e) => {
          if (e.event === "Started") total = e.data.contentLength;
          if (e.event === "Progress") {
            done += e.data.chunkLength;
            onProgress(done, total);
          }
        });
      },
      install: () => update.install(),
    };
  },
  relaunch,
};

/** The real updater in the app; in the browser preview a stub chosen by `?update=` (see preview/updater.ts). */
export const updater: Updater = desktop
  ? tauriUpdater
  : previewUpdater(new URLSearchParams(location.search).get("update"));
