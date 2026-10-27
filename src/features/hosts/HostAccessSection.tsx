import type { HostDraft, View } from "@/lib/types";
import { HostPasswordInput } from "./HostPasswordInput";
import { HostCredentialsField } from "./HostCredentialsField";
import { HostPortField } from "./HostPortField";
import { InheritedIdentityNotice } from "./InheritedIdentityNotice";
import { OfferedIdentityNotice } from "./OfferedIdentityNotice";
import { inheritedIdentity } from "./groups.ts";
import { divider, section, sheetField, subheading } from "@/lib/editor-ui";

export function HostAccessSection({
  value,
  view,
  onChange,
  onNewIdentity,
  onRevealPassword,
}: {
  value: HostDraft;
  view: View;
  onChange: (v: HostDraft) => void;
  onNewIdentity: () => void;
  onRevealPassword?: () => Promise<string>;
}) {
  const existing = view.hosts.find((h) => h.id === value.id);
  const credentials = value.credentials ?? {
    username: value.username ?? "",
    password: "",
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
      <legend className="sr-only">Accesso SSH</legend>
      <HostPortField value={value} view={view} onChange={onChange} />
      <div className={divider} />
      <h3 className={subheading}>Credenziali</h3>
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
            onChange={onChange}
            onNewIdentity={onNewIdentity}
          />
        </>
      )}
      {!inheriting && (
        <div className={sheetField}>
          <HostPasswordInput
            key={`${view.vaultId}:${value.id}:${value.identityId}`}
            hasSavedPassword={!!existing?.hasPassword && !value.identityId}
            onReveal={onRevealPassword}
            aria-label="Password SSH"
            required={!value.identityId && !existing?.hasPassword}
            disabled={!!selectedIdentity}
            autoComplete="new-password"
            value={selectedIdentity ? "" : credentials.password}
            placeholder={
              selectedIdentity ? "Gestita dall’identità" : "Password"
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
    </fieldset>
  );
}
