import { t } from "../../i18n/i18n.ts";
// Pure parts of the update flow: what the status is, how a failure reads and how far a download is.
import { describeError } from "../../lib/error-message.ts";

/** The check runs this long after launch, so it never competes with the unlock screen for the network. */
export const LAUNCH_CHECK_DELAY_MS = 5000;

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate" }
  | { kind: "available"; version: string }
  | { kind: "downloading"; version: string; percent: number | null }
  | { kind: "ready"; version: string }
  | { kind: "installing"; version: string }
  | { kind: "error"; message: string };

/** Whole percent of a download, or null while the server did not announce a size. */
export function percentOf(done: number, total?: number): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.max(0, Math.floor((done / total) * 100)));
}

/** A failure in plain words for the usual causes; anything else keeps the plugin's own text. */
export function updateFailure(error: unknown): string {
  const text = describeError(error);
  if (/pubkey|public key|base64|signature|minisign/i.test(text))
    return t("settings.updateFlow.theUpdateSigningKey");
  if (
    /network|dns|connect|timed? ?out|error sending request|offline/i.test(text)
  )
    return t("settings.updateFlow.unreachable");
  if (/valid release json|404|not found/i.test(text))
    return t("settings.updateFlow.noManifest");
  return text || t("settings.updateFlow.unknownError");
}

/** True while a check, download or install is running, so a second one must not start. */
export const isBusy = (status: UpdateStatus): boolean =>
  status.kind === "checking" ||
  status.kind === "downloading" ||
  status.kind === "installing";

export function statusLine(status: UpdateStatus): string {
  switch (status.kind) {
    case "idle":
      return "";
    case "checking":
      return t("settings.updateFlow.checking");
    case "uptodate":
      return t("settings.updateFlow.upToDate");
    case "available":
      return t("settings.updateFlow.available", { version: status.version });
    case "downloading":
      return status.percent === null
        ? t("settings.updateFlow.downloading", { version: status.version })
        : t("settings.updateFlow.downloadingPercent", {
            version: status.version,
            percent: status.percent,
          });
    case "ready":
      return t("settings.updateFlow.ready", { version: status.version });
    case "installing":
      return t("settings.updateFlow.installing", { version: status.version });
    case "error":
      return t("settings.updateFlow.checkFailed", { message: status.message });
  }
}
