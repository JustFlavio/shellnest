import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/SelectField";
import { IconButton } from "@/components/IconButton";
import { card, cardTitle } from "@/features/settings/settings-ui";
import { help, muted } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import type { Role } from "@/lib/types";
import { useApp } from "@/app/app-context";
import {
  DevicesDialog,
  ExposedDialog,
  InviteDialog,
  PasswordDialog,
} from "./AccountDialogs";

const badge =
  "rounded-[6px] border border-input px-[6px] py-[1px] text-[11px] text-muted-foreground";

function AccountCard() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    account,
  } = useApp();
  const signedIn = view.account;
  return (
    <section className={card}>
      <h3 className={cardTitle}>{t("vault.serverSettings.account")}</h3>
      {signedIn ? (
        <>
          <p className="m-0 text-[13px]">
            {t("vault.serverSettings.signedInAs", {
              username: signedIn.username,
              server: signedIn.server,
            })}
          </p>
          <p className={help}>
            {t("vault.serverSettings.safetyCode", {
              code: signedIn.safetyCode,
            })}
          </p>
          <div className="mt-[10px] flex flex-wrap gap-[8px]">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={busy || !signedIn.unlocked}
              onClick={account.loadDevices}
            >
              {t("vault.serverSettings.devices")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={busy || !signedIn.unlocked}
              onClick={() => account.setPasswordOpen(true)}
            >
              {t("vault.accountDialogs.changePassword")}
            </Button>
            {signedIn.admin && (
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={busy || !signedIn.unlocked}
                onClick={() => account.createInvite(false)}
              >
                <UserPlus size={14} />
                {t("vault.serverSettings.invite")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={busy}
              onClick={account.signOut}
            >
              {t("vault.serverSettings.signOut")}
            </Button>
          </div>
          <p className={help}>{t("vault.serverSettings.signOutHelp")}</p>
        </>
      ) : (
        <>
          <p className={muted}>{t("vault.serverSettings.noAccount")}</p>
          <div className="mt-[10px] flex flex-wrap gap-[8px]">
            <Button
              variant="default"
              size="sm"
              type="button"
              disabled={busy || !desktop}
              onClick={() => account.openForm("signIn")}
            >
              {t("vault.vaultCopy.signIn")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={busy || !desktop}
              onClick={() => account.openForm("register")}
            >
              {t("vault.accountForm.haveInvite")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function AddMember() {
  const { t } = useTranslation();
  const {
    vault: { busy },
    account,
  } = useApp();
  const [username, setUsername] = useState(""),
    [role, setRole] = useState<Role>("editor");
  return (
    <form
      className="mt-[10px] flex flex-wrap items-end gap-[8px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (username.trim())
          account.addMember(username, role, () => setUsername(""));
      }}
    >
      <label className="grid min-w-[160px] flex-1 gap-[6px] text-[13px]">
        {t("vault.accountForm.username")}
        <Input
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
        />
      </label>
      <RoleSelect value={role} onChange={setRole} />
      <Button
        variant="outline"
        type="submit"
        disabled={busy || !username.trim()}
      >
        {t("vault.serverSettings.addMember")}
      </Button>
    </form>
  );
}

function RoleSelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <SelectField
      aria-label={label ?? t("vault.serverSettings.role")}
      className="w-[140px]"
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as Role)}
      options={(["owner", "editor", "viewer"] as const).map((r) => ({
        value: r,
        label: t(`vault.serverSettings.roles.${r}`),
      }))}
    />
  );
}

function Members() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    account,
  } = useApp();
  const owner = view.remote?.role === "owner";
  const { members, loadMembers } = account;
  const shown = !!view.remote && view.unlocked;
  // Once per vault: a failed load shows its error instead of retrying on every render.
  const loadedFor = useRef("");
  useEffect(() => {
    if (!shown || loadedFor.current === view.vaultId) return;
    loadedFor.current = view.vaultId;
    loadMembers();
  }, [shown, view.vaultId, loadMembers]);
  if (!members) return null;
  return (
    <>
      <h4 className="mt-[14px] mb-[4px] text-[12px] font-semibold text-muted-foreground">
        {t("vault.serverSettings.members")}
      </h4>
      <ul className="m-0 grid list-none gap-[2px] p-0">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[4px] text-[13px]"
          >
            <span className="grid">
              <span className="truncate">
                {m.username}
                {m.me && ` · ${t("vault.serverSettings.you")}`}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {m.safetyCode}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-[4px]">
              {owner && !m.me ? (
                <>
                  <RoleSelect
                    label={t("vault.serverSettings.roleOf", {
                      name: m.username,
                    })}
                    value={m.role}
                    disabled={busy}
                    onChange={(role) => account.setRole(m.userId, role)}
                  />
                  <IconButton
                    label={t("vault.serverSettings.remove", {
                      name: m.username,
                    })}
                    disabled={busy}
                    onClick={() => account.removeMember(m.userId)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </>
              ) : (
                <span className={badge}>
                  {t(`vault.serverSettings.roles.${m.role}`)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {owner && <AddMember />}
      <p className={help}>{t("vault.serverSettings.membersHelp")}</p>
    </>
  );
}

function VaultServerCard() {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    sync: { synchronize, syncState, lastSync },
    account,
  } = useApp();
  return (
    <section className={card}>
      <h3 className={cardTitle}>
        {t("vault.serverSettings.vaultTitle", { name: view.vaultName })}
      </h3>
      {view.remote ? (
        <>
          <p className="m-0 flex flex-wrap items-center gap-[6px] text-[13px]">
            <span className={badge}>
              {t(`vault.serverSettings.roles.${view.remote.role}`)}
            </span>
            {t("vault.serverSettings.membersCount", {
              count: view.remote.members,
            })}
            {lastSync &&
              ` · ${t("vault.vaultCopy.lastSyncOk", { time: lastSync })}`}
          </p>
          {view.remote.role === "viewer" && (
            <p className={help}>{t("vault.serverSettings.viewerHelp")}</p>
          )}
          <div className="mt-[10px]">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={busy || syncState === "syncing"}
              onClick={() => void synchronize(true)}
            >
              <RefreshCw size={14} />
              {t("vault.serverSettings.syncNow")}
            </Button>
          </div>
          <p className={help}>{t("vault.serverSettings.syncHelp")}</p>
          <Members />
        </>
      ) : (
        <>
          <p className={muted}>{t("vault.serverSettings.localVault")}</p>
          <div className="mt-[10px]">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={busy || !view.account?.unlocked}
              onClick={account.upload}
            >
              {t("vault.serverSettings.upload")}
            </Button>
          </div>
          <p className={help}>
            {view.account?.unlocked
              ? t("vault.serverSettings.uploadHelp")
              : t("vault.serverSettings.uploadNeedsAccount")}
          </p>
        </>
      )}
    </section>
  );
}

/** The sync account and the open vault on the server, in the vault settings. */
export function ServerSettings() {
  return (
    <>
      <AccountCard />
      <VaultServerCard />
      <DevicesDialog />
      <PasswordDialog />
      <InviteDialog />
      <ExposedDialog />
    </>
  );
}
