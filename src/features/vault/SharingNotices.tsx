import { useTranslation } from "react-i18next";
import { Share2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { help } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

/** In a vault on the server, who can use this identity, and the way to share it. */
export function IdentitySharing({ identityId }: { identityId: string }) {
  const { t } = useTranslation();
  const {
    vault: { view, busy },
    account,
  } = useApp();
  if (!view.remote) return null;
  const existing = view.identities.find((i) => i.id === identityId);
  if (!existing)
    return <p className={help}>{t("vault.sharing.newIsPrivate")}</p>;
  if (existing.shared)
    return <p className={help}>{t("vault.sharing.shared")}</p>;
  return (
    <div className="mt-[8px] grid gap-[6px]">
      <p className={help}>{t("vault.sharing.private")}</p>
      {view.remote.role !== "viewer" && (
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="justify-self-start"
          disabled={busy}
          onClick={() => account.shareIdentity(identityId)}
        >
          <Share2 size={14} />
          {t("vault.sharing.share")}
        </Button>
      )}
    </div>
  );
}

/** A viewer of a shared vault can only choose their own credentials. */
export function ReadOnlyNotice() {
  const { t } = useTranslation();
  const {
    vault: { view },
  } = useApp();
  if (view.remote?.role !== "viewer") return null;
  return <Alert className="mb-[12px]">{t("vault.sharing.readOnly")}</Alert>;
}
