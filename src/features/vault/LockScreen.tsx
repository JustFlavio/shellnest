import { useTranslation } from "react-i18next";
import { BrandIcon } from "@/app/BrandIcon";
import { Button } from "@/components/ui/button";
import { help, muted } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import { useApp } from "@/app/app-context";
import { TitleBar } from "@/app/TitleBar";
import { AccountForm } from "./AccountForm";
import { BrowserGate } from "./BrowserGate";
import { UnlockForm } from "./UnlockForm";
import { VaultPanels } from "./VaultPanels";
import { VaultSwitcher } from "./VaultSwitcher";
import { lockLead, lockTitle } from "./vault-copy.ts";
import { Alert } from "@/components/ui/alert";

export function LockScreen() {
  const { t } = useTranslation();
  const {
    vault: { view, busy, preview, error },
    account,
  } = useApp();
  const interactive = desktop || preview;
  const form = account.form;
  const state = {
    exists: view.exists,
    account: form?.mode ?? null,
    interactive,
  };
  const lead = lockLead(state);
  return (
    <main className="relative grid h-dvh place-items-center overflow-auto px-[20px] pt-[64px] pb-[24px]">
      <TitleBar />
      <section className="w-[370px] max-w-full [&_form]:mt-[25px] [&_input]:h-[40px] [&_input]:text-[15px]">
        <div className="mb-[32px] flex items-center gap-[9px] text-[13px] font-semibold whitespace-nowrap">
          <BrandIcon />
          Shellnest
        </div>
        {interactive && !form && (
          <div className="[&>button]:mb-[24px]">
            <VaultSwitcher />
          </div>
        )}
        <h1 className="mb-[12px] text-[22px]">{lockTitle(state)}</h1>
        {lead && <p className={muted}>{lead}</p>}
        {error && !form && (
          <Alert variant="destructive" className="mb-[12px]">
            {error}
          </Alert>
        )}
        {!interactive ? (
          <BrowserGate />
        ) : form ? (
          <AccountForm />
        ) : (
          <UnlockForm />
        )}
        {desktop && form && (
          <Button
            variant="link"
            type="button"
            className="mx-auto my-[18px] flex"
            onClick={account.closeForm}
            disabled={busy}
          >
            {t("vault.lockScreen.back")}
          </Button>
        )}
        {desktop && !form && !view.account && (
          <Button
            variant="link"
            type="button"
            className="mx-auto my-[18px] flex"
            onClick={() => account.openForm("signIn")}
            disabled={busy}
          >
            {t("vault.lockScreen.signInToServer")}
          </Button>
        )}
        {interactive && !view.exists && !form && (
          <p className={help}>{t("vault.lockScreen.atLeast12Characters")}</p>
        )}
      </section>
      <VaultPanels />
    </main>
  );
}
