import { BrandIcon } from "@/app/BrandIcon";
import { Button } from "@/components/ui/button";
import { errorBox, help, muted } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import { useApp } from "@/app/app-context";
import { TitleBar } from "@/app/TitleBar";
import { BrowserGate } from "./BrowserGate";
import { UnlockForm } from "./UnlockForm";
import { VaultPanels } from "./VaultPanels";
import { VaultSwitcher } from "./VaultSwitcher";
import { lockLead, lockTitle } from "./vault-copy.ts";

export function LockScreen() {
  const {
    vault: { view, busy, preview, error },
    unlock,
  } = useApp();
  const interactive = desktop || preview;
  const state = { exists: view.exists, restore: unlock.restore, interactive };
  const lead = lockLead(state);
  return (
    <main className="relative grid h-dvh place-items-center overflow-auto px-[20px] pt-[64px] pb-[24px]">
      <TitleBar />
      <section className="w-[370px] max-w-full [&_form]:mt-[25px] [&_input]:h-[40px] [&_input]:text-[15px]">
        <div className="mb-[32px] flex items-center gap-[9px] text-[13px] font-semibold whitespace-nowrap">
          <BrandIcon />
          Shellnest
        </div>
        {interactive && (
          <div className="[&>button]:mb-[24px]">
            <VaultSwitcher />
          </div>
        )}
        <h1 className="mb-[12px] text-[22px]">{lockTitle(state)}</h1>
        {lead && <p className={muted}>{lead}</p>}
        {error && (
          <p className={errorBox} role="alert">
            {error}
          </p>
        )}
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
        {interactive && !view.exists && !unlock.restore && (
          <p className={help}>
            Minimo 12 caratteri. La password principale non è recuperabile.
          </p>
        )}
      </section>
      <VaultPanels />
    </main>
  );
}
