import { useTranslation } from "react-i18next";
import { SelectField } from "@/components/SelectField";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Plus } from "lucide-react";
import type { Identity, IdentityForm, SshKey } from "@/lib/types";
import { EditorSection } from "./EditorSection";
import { Alert } from "@/components/ui/alert";
import { useFieldError } from "@/components/FieldErrors";

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
  const keyError = useFieldError("key");
  const passwordError = useFieldError("password");
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
          <label {...keyError.field}>
            {t("hosts.identityAccessSection.keyFromTheKey")}
            <SelectField
              {...keyError.control}
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
            {keyError.message}
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
        <label {...passwordError.field}>
          {t("hosts.collectionTables.password")}
          <PasswordInput
            aria-label={t("hosts.collectionTables.password")}
            {...passwordError.control}
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
          {passwordError.message}
        </label>
      )}
      {existing && existing.hostCount > 0 && (
        <Alert className="mt-[12px]">
          {t("hosts.identityAccessSection.changeAffects", {
            count: existing.hostCount,
          })}
        </Alert>
      )}
    </EditorSection>
  );
}
