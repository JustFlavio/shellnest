import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HostDraft, View } from "@/lib/types";
import { HostPasswordInput } from "./HostPasswordInput";
import { HostCredentialsField } from "./HostCredentialsField";
import { groupPath, inheritedIdentity, portSource } from "./groups.mjs";
import {
  divider,
  inheritedBox,
  portInline,
  section,
  sectionHelp,
  sheetField,
  subheading,
} from "@/lib/editor-ui";

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
  const portFrom = portSource(view.groups, value.groupId);
  const folderIdentity = inheritedIdentity(view.groups, value.groupId);
  const inherited = view.identities.find(
    (i) => i.id === folderIdentity?.identityId,
  );
  return (
    <fieldset className={section}>
      <legend className="sr-only">Accesso SSH</legend>
      <label className={cn(portInline, "m-0! text-[14px]! font-semibold")}>
        Porta SSH
        <Input
          type="number"
          min={1}
          max={65535}
          value={value.ownPort ?? ""}
          placeholder={String(
            portSource(view.groups, value.groupId)?.port ?? 22,
          )}
          onChange={(e) =>
            onChange({
              ...value,
              ownPort: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
      {value.ownPort === null && portFrom && (
        <p className={sectionHelp}>
          Porta ereditata dal gruppo {groupPath(view.groups, portFrom.id)}.
        </p>
      )}
      <div className={divider} />
      <h3 className={subheading}>Credenziali</h3>
      {value.inheritIdentity && folderIdentity ? (
        <div className={inheritedBox}>
          <ContactRound aria-hidden="true" />
          <span>
            Identità <strong>{inherited?.name ?? "—"}</strong>
            {inherited ? ` (${inherited.username})` : ""} dal gruppo{" "}
            <strong>{groupPath(view.groups, folderIdentity.id)}</strong>
          </span>
          <Button
            variant="ghost"
            type="button"
            className="shrink-0 text-[12px] text-primary"
            onClick={() => onChange({ ...value, inheritIdentity: false })}
          >
            Usa credenziali proprie
          </Button>
        </div>
      ) : (
        <>
          {folderIdentity && (
            <div className={inheritedBox}>
              <ContactRound aria-hidden="true" />
              <span>
                Il gruppo{" "}
                <strong>{groupPath(view.groups, folderIdentity.id)}</strong>{" "}
                offre l’identità <strong>{inherited?.name ?? "—"}</strong>.
              </span>
              <Button
                variant="ghost"
                type="button"
                className="shrink-0 text-[12px] text-primary"
                onClick={() =>
                  onChange({
                    ...value,
                    inheritIdentity: true,
                    identityId: "",
                    credentials: { username: "", password: "" },
                  })
                }
              >
                Usala
              </Button>
            </div>
          )}
          <HostCredentialsField
            value={value}
            identities={view.identities}
            onChange={onChange}
            onNewIdentity={onNewIdentity}
          />
        </>
      )}
      {!(value.inheritIdentity && folderIdentity) && (
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
      {!value.identityId && !value.inheritIdentity && existing?.hasPassword && (
        <p className={sectionHelp}>
          Lascia vuoto per mantenere la password salvata.
        </p>
      )}
    </fieldset>
  );
}
