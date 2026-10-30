import { useTranslation } from "react-i18next";
import type { HostDraft, View } from "@/lib/types";
import { HostPasswordInput } from "./HostPasswordInput";
import { HostCredentialsField } from "./HostCredentialsField";
import { HostKeyField } from "./HostKeyField";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Plus, UserRound, KeyRound } from "lucide-react";
import { InheritedIdentityNotice } from "./InheritedIdentityNotice";
import { OfferedIdentityNotice } from "./OfferedIdentityNotice";
import { inheritedIdentity } from "./groups.ts";
import { section, sheetField, subheading } from "@/lib/editor-ui";

export function HostAccessSection({
  value,
  view,
  onChange,
  onNewIdentity,
  onNewKey,
  onRevealPassword,
}: {
  value: HostDraft;
  view: View;
  onChange: (v: HostDraft) => void;
  onNewIdentity: () => void;
  onNewKey?: () => void;
  onRevealPassword?: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const existing = view.hosts.find((h) => h.id === value.id);
  const credentials = value.credentials ?? {
    username: value.username ?? "",
    password: "",
    keyId: value.keyId,
  };
  const selectedIdentity = view.identities.find(
    (i) => i.id === value.identityId,
  );
  const folderIdentity = inheritedIdentity(view.groups, value.groupId);
  const inheriting = !!(value.inheritIdentity && folderIdentity);
  const inherited = view.identities.find(
    (i) => i.id === folderIdentity?.identityId,
  );
  return (
    <fieldset className={section}>
      <legend className="sr-only">
        {t("hosts.hostAccessSection.sshAccess")}
      </legend>
      <h3 className={subheading}>{t("hosts.hostAccessSection.credentials")}</h3>
      {value.inheritIdentity && folderIdentity ? (
        <InheritedIdentityNotice
          value={value}
          folder={folderIdentity}
          identity={inherited}
          groups={view.groups}
          onChange={onChange}
        />
      ) : (
        <>
          {folderIdentity && (
            <OfferedIdentityNotice
              value={value}
              folder={folderIdentity}
              identity={inherited}
              groups={view.groups}
              onChange={onChange}
            />
          )}
          <HostCredentialsField
            value={value}
            identities={view.identities}
            keys={view.keys}
            onChange={onChange}
          />
        </>
      )}
      {!inheriting && (selectedIdentity || credentials.keyId === undefined) && (
        <div className={sheetField}>
          <HostPasswordInput
            key={`${view.vaultId}:${value.id}:${value.identityId}`}
            hasSavedPassword={!!existing?.hasPassword && !value.identityId}
            onReveal={onRevealPassword}
            aria-label={t("hosts.hostAccessSection.sshPassword")}
            required={!value.identityId && !existing?.hasPassword}
            disabled={!!selectedIdentity}
            autoComplete="new-password"
            value={selectedIdentity ? "" : credentials.password}
            placeholder={
              selectedIdentity
                ? t("hosts.hostAccessSection.managedByTheIdentity")
                : t("hosts.collectionTables.password")
            }
            onChange={(e) =>
              onChange({
                ...value,
                credentials: { ...credentials, password: e.target.value },
              })
            }
          />
        </div>
      )}
      {!inheriting && !selectedIdentity && credentials.keyId !== undefined && (
        <>
          <HostKeyField
            value={credentials.keyId}
            keys={view.keys}
            onNewKey={onNewKey}
            onChange={(keyId) =>
              onChange({
                ...value,
                credentials: { ...credentials, keyId, password: "" },
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...value,
                credentials: { ...credentials, keyId: undefined, password: "" },
              })
            }
          >
            {t("hosts.hostAccessSection.password")}
          </Button>
        </>
      )}
      {!inheriting && !selectedIdentity && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" className="mt-[8px]" />
            }
          >
            <Plus size={16} />
            {t("hosts.hostAccessSection.add")}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onNewIdentity}>
              <UserRound />
              {t("hosts.hostAccessSection.newIdentity")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                onChange({
                  ...value,
                  credentials: { ...credentials, keyId: "", password: "" },
                })
              }
            >
              <KeyRound />
              {t("hosts.hostCredentialsField.sshKey")}
            </DropdownMenuItem>
            {onNewKey && (
              <DropdownMenuItem onClick={onNewKey}>
                <Plus />
                {t("hosts.hostAccessSection.importKey")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </fieldset>
  );
}
