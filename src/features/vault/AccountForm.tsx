import { useTranslation } from "react-i18next";
import { PasswordInput } from "@/components/PasswordInput";
import { TextField } from "@/components/TextField";
import { FieldErrors, FieldSlot } from "@/components/FieldErrors";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { help } from "@/lib/editor-ui";
import { useFormErrors } from "@/lib/useFormErrors";
import { useApp } from "@/app/app-context";
import { accountChecks } from "./account-checks.ts";
import type { AccountDraft } from "./account-checks.ts";

const FIELDS = [
  "server",
  "username",
  "password",
  "confirm",
  "invite",
  "recoveryKey",
] as const;

function PasswordField({
  name,
  label,
  value,
  onChange,
  autoComplete,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <FieldSlot name={name}>
      {(control) => (
        <label>
          {label}
          <PasswordInput
            aria-label={label}
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...control}
          />
        </label>
      )}
    </FieldSlot>
  );
}

/** Sign in, sign up with an invite, or recover with the recovery key. Shown on the lock screen and in a dialog. */
export function AccountForm({ id = "account-form" }: { id?: string }) {
  const { t } = useTranslation();
  const {
    vault: { busy, error, errorField },
    account,
  } = useApp();
  const form = account.form;
  const checks = form ? accountChecks(form.mode, form.draft) : {};
  const errors = useFormErrors(
    form?.mode ?? "",
    checks,
    FIELDS,
    error,
    errorField,
  );
  if (!form) return null;
  const { mode, draft } = form;
  const set = (patch: Partial<AccountDraft>) =>
    account.setForm({ mode, draft: { ...draft, ...patch } });
  const newPassword = mode !== "signIn";
  return (
    <form
      id={id}
      noValidate
      onBlur={errors.onBlur}
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.check(e.currentTarget)) account.submitForm();
      }}
    >
      {errors.banner && (
        <Alert variant="destructive" className="mb-[12px]">
          {errors.banner}
        </Alert>
      )}
      <FieldErrors errors={errors.errors}>
        <TextField
          name="server"
          label={t("vault.accountForm.server")}
          type="url"
          autoFocus={!draft.server}
          placeholder="https://sync.example.com"
          value={draft.server}
          onChange={(e) => set({ server: e.target.value })}
        />
        {mode === "register" && (
          <TextField
            name="invite"
            label={t("vault.accountForm.invite")}
            autoComplete="off"
            value={draft.invite}
            onChange={(e) => set({ invite: e.target.value })}
          />
        )}
        <TextField
          name="username"
          label={t("vault.accountForm.username")}
          autoComplete="username"
          autoCapitalize="none"
          autoFocus={!!draft.server && !draft.username}
          value={draft.username}
          onChange={(e) => set({ username: e.target.value.toLowerCase() })}
        />
        {mode === "recover" && (
          <TextField
            name="recoveryKey"
            label={t("vault.accountForm.recoveryKey")}
            autoComplete="off"
            className="[&_input]:font-mono"
            value={draft.recoveryKey}
            onChange={(e) => set({ recoveryKey: e.target.value })}
          />
        )}
        <PasswordField
          name="password"
          label={
            newPassword
              ? t("vault.accountForm.newPassword")
              : t("vault.accountForm.password")
          }
          autoComplete={newPassword ? "new-password" : "current-password"}
          value={draft.password}
          onChange={(password) => set({ password })}
        />
        {newPassword && (
          <PasswordField
            name="confirm"
            label={t("vault.unlockForm.confirmPassword")}
            autoComplete="new-password"
            value={draft.confirm}
            onChange={(confirm) => set({ confirm })}
          />
        )}
      </FieldErrors>
      {newPassword && (
        <p className={help}>{t("vault.accountForm.passwordHelp")}</p>
      )}
      <Button
        variant="default"
        type="submit"
        className="mt-[8px] h-[40px] w-full"
        disabled={busy}
      >
        {busy
          ? t("vault.vaultCopy.wait")
          : t(`vault.accountForm.submit.${mode}`)}
      </Button>
      <div className="mt-[12px] flex flex-wrap justify-center gap-x-[12px]">
        {mode !== "signIn" && (
          <Button
            variant="link"
            type="button"
            disabled={busy}
            onClick={() => account.setForm({ mode: "signIn", draft })}
          >
            {t("vault.accountForm.haveAccount")}
          </Button>
        )}
        {mode !== "register" && (
          <Button
            variant="link"
            type="button"
            disabled={busy}
            onClick={() => account.setForm({ mode: "register", draft })}
          >
            {t("vault.accountForm.haveInvite")}
          </Button>
        )}
        {mode === "signIn" && (
          <Button
            variant="link"
            type="button"
            disabled={busy}
            onClick={() => account.setForm({ mode: "recover", draft })}
          >
            {t("vault.accountForm.forgotPassword")}
          </Button>
        )}
      </div>
    </form>
  );
}
