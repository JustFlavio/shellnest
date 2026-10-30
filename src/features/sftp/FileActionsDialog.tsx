import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/features/hosts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import type { FileBrowser } from "./useFileBrowser";
import type { FileEntry } from "./types";

export type FileAction = "mkdir" | "rename" | "delete";
export function FileActionsDialog({
  action,
  browser,
  entries,
  onClose,
}: {
  action: FileAction;
  browser: FileBrowser;
  entries: FileEntry[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [targets] = useState(entries);
  const [value, setValue] = useState(
    action === "rename" ? (entries[0]?.name ?? "") : "",
  );
  const [busy, setBusy] = useState(false);
  const paths = targets.map((entry) => entry.path);
  const submit = async () => {
    if (!browser.directory) return;
    setBusy(true);
    const done = await browser.mutate(
      action === "mkdir"
        ? { type: "mkdir", parent: browser.directory.path, name: value }
        : action === "rename"
          ? { type: "rename", path: paths[0], name: value }
          : { type: "delete", paths },
    );
    setBusy(false);
    if (done) onClose();
  };
  return (
    <Panel
      variant={action === "delete" ? "alert" : "dialog"}
      title={t(`sftp.${action}`)}
      onClose={onClose}
      busy={busy}
      error={browser.error}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {action === "delete" ? (
          <AlertDialogDescription>
            {t("sftp.deleteConfirm", { count: paths.length })}
          </AlertDialogDescription>
        ) : (
          <label className="grid gap-2">
            {t("sftp.name")}
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
        )}
        <footer className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {t("sftp.cancel")}
          </Button>
          <Button
            variant={action === "delete" ? "destructive" : "default"}
            disabled={busy || (action !== "delete" && !value.trim())}
            type="submit"
          >
            {t(`sftp.${action}`)}
          </Button>
        </footer>
      </form>
    </Panel>
  );
}
