import type { Updater } from "../updater";

// The browser preview has no updater plugin. `?update=` picks what a check finds, so tests can drive the flow:
//   available  an update, downloaded at once
//   hold       an update whose download stops at 40% until window.__releaseUpdate() is called
//   error      the check fails
//   (other)    no update
// "Restart" sets window.__relaunched instead of quitting.
export function previewUpdater(mode: string | null): Updater {
  return {
    async check() {
      if (mode === "error") throw new Error("Errore simulato in check");
      if (mode !== "available" && mode !== "hold") return null;
      return {
        version: "9.9.9",
        async download(onProgress) {
          onProgress(400, 1000);
          if (mode === "hold")
            await new Promise<void>((release) =>
              Object.assign(window, { __releaseUpdate: release }),
            );
          onProgress(1000, 1000);
        },
        install: async () => {},
      };
    },
    relaunch: async () => {
      Object.assign(window, { __relaunched: true });
    },
  };
}
