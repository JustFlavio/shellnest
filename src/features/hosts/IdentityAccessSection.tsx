import { useTranslation } from "react-i18next";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Plus } from "lucide-react";
import type { Identity, IdentityForm, SshKey } from "@/lib/types";
import { callout } from "@/lib/editor-ui";
import { EditorSection } from "./EditorSection";

export function IdentityAccessSection({
  value,
  onChange,
  keys,
  existing,
  onNewKey,
}: {
  value: IdentityForm;
  onChange: (v: IdentityForm) => void;
  keys: SshKey[];
  existing: Identity | undefined;
  onNewKey: () => void;
}) {
  const { t } = useTranslation();
  return (
    <EditorSection title={t("hosts.hostAccessSection.sshAccess")}>
      <label>
        {t("hosts.identityAccessSection.method")}
        <SelectField
          aria-label={t("hosts.identityAccessSection.authenticationMethod")}
          value={value.auth}
          onValueChange={(auth) =>
            onChange({
              ...value,
              auth: auth as "key" | "password",
              password: "",
              keyId: "",
            })
          }
          options={[
            { value: "key", label: t("hosts.hostCredentialsField.sshKey") },
            { value: "password", label: t("hosts.collectionTables.password") },
          ]}
        />
      </label>
      {value.auth === "key" ? (
        <>
          <label>
            {t("hosts.identityAccessSection.keyFromTheKey")}
            <SelectField
              aria-label={t("hosts.identityAccessSection.keyFromTheKey")}
              required
              value={value.keyId}
              onValueChange={(keyId) => onChange({ ...value, keyId })}
              placeholder={t("hosts.identityAccessSection.selectAKey")}
              options={keys.map((k) => ({
                value: k.id,
                label: k.name,
              }))}
            />
          </label>
          <Button
            variant="link"
            className="mt-[10px]"
            type="button"
            onClick={onNewKey}
          >
            <Plus size={14} />
            {t("hosts.identityAccessSection.importAKey")}
          </Button>
        </>
      ) : (
        <label>
          {t("hosts.collectionTables.password")}
          <PasswordInput
            autoComplete="new-password"
            required={!existing?.hasPassword}
            value={value.password}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            placeholder={
              existing?.hasPassword
                ? t("hosts.identityAccessSection.leaveEmptyToKeep")
                : ""
            }
          />
        </label>
      )}
      {existing && existing.hostCount > 0 && (
        <div className={callout}>
          {t("hosts.identityAccessSection.changeAffects", {
            count: existing.hostCount,
          })}
        </div>
      )}
    </EditorSection>
  );
}
