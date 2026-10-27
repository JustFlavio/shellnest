import { BrandIcon } from "@/app/BrandIcon";
import { Button } from "@/components/ui/button";
import { callout, help, muted } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import { useApp } from "@/app/app-context";
import { ErrorBanner } from "@/app/Banners";
import { TitleBar } from "@/app/TitleBar";
import { BrowserGate } from "./BrowserGate";
import { UnlockForm } from "./UnlockForm";
import { VaultPanels } from "./VaultPanels";
import { VaultSwitcher } from "./VaultSwitcher";
import { lockLead, lockTitle } from "./vault-copy.mjs";

export function LockScreen() {
  const {
    vault: { view, busy, preview },
    unlock,
  } = useApp();
  const interactive = desktop || preview;
  const state = { exists: view.exists, restore: unlock.restore, interactive };
  return (
    <main className="relative grid h-dvh place-items-center overflow-auto px-[20px] pt-[64px] pb-[24px]">
      <TitleBar />
      <section className="w-[370px] max-w-full [&_form]:mt-[25px] [&_input]:h-[40px] [&_input]:text-[15px]">
        <div className="mb-[32px] flex items-center gap-[9px] text-[13px] font-semibold whitespace-nowrap">
          <BrandIcon />
          Shellnest
          <span className="ml-auto text-[12px] font-normal text-muted-foreground">
            {desktop ? "0.3 · In sviluppo" : "Anteprima browser"}
          </span>
        </div>
        {interactive && (
          <div className="[&>button]:mb-[24px]">
            <VaultSwitcher />
          </div>
        )}
        <h1 className="mb-[12px] text-[22px]">{lockTitle(state)}</h1>
        <p className={muted}>{lockLead(state)}</p>
        {preview && (
          <p className={callout}>
            Anteprima in memoria: usa una password fittizia. Nessun dato viene
            cifrato o conservato dopo il ricaricamento.
          </p>
        )}
        <ErrorBanner />
        {interactive ? <UnlockForm /> : <BrowserGate />}
        {desktop && !view.exists && (
          <Button
            variant="link"
            type="button"
            className="mx-auto my-[18px] flex"
            onClick={unlock.toggleRestore}
            disabled={busy}
          >
            {unlock.restore
              ? "Crea un vault locale"
              : "Collega un vault esistente"}
          </Button>
        )}
        <p className="mt-[28px] text-[12px] leading-[1.7] text-muted-foreground">
          La sincronizzazione è opzionale. Nessun account necessario per l’uso
          locale.
        </p>
        {interactive && !view.exists && !unlock.restore && (
          <p className={help}>
            Usa almeno 12 caratteri. La password principale non è recuperabile:
            conservala in un gestore di password.
          </p>
        )}
      </section>
      <VaultPanels />
    </main>
  );
}
