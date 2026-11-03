import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Panel } from "@/features/hosts/Panel";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { IconButton } from "@/components/IconButton";
import { PasswordInput } from "@/components/PasswordInput";
import { FieldErrors, FieldSlot } from "@/components/FieldErrors";
import { help, muted } from "@/lib/editor-ui";
import { notifyError } from "@/lib/notify";
import { useFormErrors } from "@/lib/useFormErrors";
import { useApp } from "@/app/app-context";
import { AccountForm } from "./AccountForm";
import { passwordChecks } from "./account-checks.ts";
import { lockTitle } from "./vault-copy.ts";

const code =
  "block rounded-[8px] bg-muted px-[10px] py-[8px] font-mono text-[13px] break-all select-all";

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <IconButton
      label={t("vault.accountDialogs.copy")}
      onClick={() =>
        void navigator.clipboard
          .writeText(text)
          .catch((e) => notifyError(t("vault.accountDialogs.copyFailed"), e))
      }
    >
      <Copy size={14} />
    </IconButton>
  );
}

/** The account form over the settings, when signing in from an unlocked vault. */
export function AccountFormDialog() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    account,
  } = useApp();
  if (!account.form || !view.unlocked) return null;
  return (
    <Panel
      variant="dialog"
      title={lockTitle({
        exists: true,
        account: account.form.mode,
        interactive: true,
      })}
      busy={busy}
      error=""
      onClose={account.closeForm}
    >
      <AccountForm id="account-dialog-form" />
    </Panel>
  );
}

/** Shown once, right after the account is created. */
export function RecoveryKeyDialog() {
  const { t } = useTranslation();
  const { account } = useApp();
  const [saved, setSaved] = useState(false);
  if (!account.recoveryKey) return null;
  return (
    <Panel
      variant="alert"
      title={t("vault.accountDialogs.recoveryTitle")}
      busy={false}
      error=""
      onClose={() => saved && account.clearRecoveryKey()}
    >
      <AlertDialogDescription>
        {t("vault.accountDialogs.recoveryLead")}
      </AlertDialogDescription>
      <div className="mt-[12px] flex items-center gap-[6px]">
        <code className={code}>{account.recoveryKey}</code>
        <CopyButton text={account.recoveryKey} />
      </div>
      <div className="mt-[16px] flex items-center justify-between gap-[12px] text-[13px]">
        {t("vault.accountDialogs.recoverySaved")}
        <Switch
          label={t("vault.accountDialogs.recoverySaved")}
          checked={saved}
          onChange={setSaved}
        />
      </div>
      <footer>
        <Button
          variant="default"
          type="button"
          className="primary"
          disabled={!saved}
          onClick={() => {
            setSaved(false);
            account.clearRecoveryKey();
          }}
        >
          {t("vault.accountDialogs.done")}
        </Button>
      </footer>
    </Panel>
  );
}

export function DevicesDialog() {
  const { t } = useTranslation();
  const {
    vault: { busy, error },
    account,
  } = useApp();
  if (!account.devices) return null;
  const date = (ms: number) => new Date(ms).toLocaleDateString();
  return (
    <Panel
      variant="dialog"
      title={t("vault.accountDialogs.devicesTitle")}
      busy={busy}
      error={error}
      onClose={account.closeDevices}
    >
      <p className={muted}>{t("vault.accountDialogs.devicesLead")}</p>
      <ul className="m-0 mt-[10px] grid list-none gap-[2px] p-0">
        {account.devices.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-[13px]"
          >
            <span className="grid">
              <span className="truncate">
                {d.name}
                {d.current && ` · ${t("vault.accountDialogs.thisDevice")}`}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {t("vault.accountDialogs.lastSeen", {
                  date: date(d.lastSeenAt),
                })}
              </span>
            </span>
            {!d.current && (
              <IconButton
                label={t("vault.accountDialogs.revoke", { name: d.name })}
                className="ml-auto"
                disabled={busy}
                onClick={() => account.revokeDevice(d.id)}
              >
                <Trash2 size={14} />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function PasswordDialog() {
  const { t } = useTranslation();
  const {
    vault: { busy, error, errorField },
    account,
  } = useApp();
  const [draft, setDraft] = useState({
    current: "",
    password: "",
    confirm: "",
  });
  const form = useFormErrors(
    "password",
    passwordChecks(draft),
    ["current", "password", "confirm"],
    error,
    // The backend names "password" for a wrong current password.
    errorField === "password" ? "current" : errorField,
  );
  if (!account.passwordOpen) return null;
  const field = (
    name: keyof typeof draft,
    label: string,
    autoComplete: string,
  ) => (
    <FieldSlot name={name}>
      {(control) => (
        <label>
          {label}
          <PasswordInput
            aria-label={label}
            autoComplete={autoComplete}
            value={draft[name]}
            onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
            {...control}
          />
        </label>
      )}
    </FieldSlot>
  );
  const close = () => {
    setDraft({ current: "", password: "", confirm: "" });
    account.setPasswordOpen(false);
  };
  return (
    <Panel
      variant="dialog"
      title={t("vault.accountDialogs.passwordTitle")}
      busy={busy}
      error={form.banner}
      onClose={close}
    >
      <form
        noValidate
        onBlur={form.onBlur}
        onSubmit={(e) => {
          e.preventDefault();
          if (form.check(e.currentTarget))
            account.changePassword(draft.current, draft.password);
        }}
      >
        <FieldErrors errors={form.errors}>
          {field(
            "current",
            t("vault.accountDialogs.currentPassword"),
            "current-password",
          )}
          {field(
            "password",
            t("vault.accountForm.newPassword"),
            "new-password",
          )}
          {field(
            "confirm",
            t("vault.unlockForm.confirmPassword"),
            "new-password",
          )}
        </FieldErrors>
        <p className={help}>{t("vault.accountDialogs.passwordHelp")}</p>
        <footer>
          <Button variant="ghost" type="button" disabled={busy} onClick={close}>
            {t("vault.deleteVaultDialog.cancel")}
          </Button>
          <Button
            variant="default"
            type="submit"
            className="primary"
            disabled={busy}
          >
            {t("vault.accountDialogs.changePassword")}
          </Button>
        </footer>
      </form>
    </Panel>
  );
}

export function InviteDialog() {
  const { t } = useTranslation();
  const {
    vault: { view },
    account,
  } = useApp();
  if (!account.invite) return null;
  return (
    <Panel
      variant="alert"
      title={t("vault.accountDialogs.inviteTitle")}
      busy={false}
      error=""
      onClose={account.clearInvite}
    >
      <AlertDialogDescription>
        {t("vault.accountDialogs.inviteLead", {
          server: view.account?.server ?? "",
        })}
      </AlertDialogDescription>
      <div className="mt-[12px] flex items-center gap-[6px]">
        <code className={code}>{account.invite}</code>
        <CopyButton text={account.invite} />
      </div>
      <footer>
        <Button
          variant="default"
          type="button"
          className="primary"
          onClick={account.clearInvite}
        >
          {t("vault.accountDialogs.done")}
        </Button>
      </footer>
    </Panel>
  );
}

/** After removing a member: the shared secrets they could read, to change on the servers. */
export function ExposedDialog() {
  const { t } = useTranslation();
  const { account } = useApp();
  if (!account.exposed) return null;
  return (
    <Panel
      variant="alert"
      title={t("vault.accountDialogs.removedTitle")}
      busy={false}
      error=""
      onClose={account.clearExposed}
    >
      <AlertDialogDescription>
        {account.exposed.length
          ? t("vault.accountDialogs.removedExposed")
          : t("vault.accountDialogs.removedNothing")}
      </AlertDialogDescription>
      {account.exposed.length > 0 && (
        <ul className="mt-[10px] list-disc pl-[20px] text-[13px]">
          {account.exposed.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
      <footer>
        <Button
          variant="default"
          type="button"
          className="primary"
          onClick={account.clearExposed}
        >
          {t("vault.accountDialogs.done")}
        </Button>
      </footer>
    </Panel>
  );
}
