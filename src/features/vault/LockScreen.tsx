import { BrandIcon } from "@/app/BrandIcon";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { callout, help, muted } from "@/lib/editor-ui";
import { desktop } from "@/lib/platform";
import { useApp } from "@/app/app-context";
import { ErrorBanner } from "@/app/Banners";
import { TitleBar } from "@/app/TitleBar";
import { VaultPanels } from "./VaultPanels";
import { VaultSwitcher } from "./VaultSwitcher";

export function LockScreen() {
  const {
    vault: { view, busy, preview },
    unlock,
    vault,
  } = useApp();
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
        {(desktop || preview) && (
          <div className="[&>button]:mb-[24px]">
            <VaultSwitcher />
          </div>
        )}
        <h1 className="mb-[12px] text-[22px]">
          {view.exists
            ? "Sblocca vault"
            : unlock.restore
              ? "Collega dispositivo"
              : desktop || preview
                ? "Crea vault locale"
                : "Esplora Shellnest"}
        </h1>
        <p className={muted}>
          {!desktop && !preview
            ? "Client SSH open source per Windows e macOS, con sincronizzazione self-hosted opzionale."
            : view.exists
              ? "Inserisci la password principale."
              : unlock.restore
                ? "Apri il vault già presente nel tuo servizio di sincronizzazione."
                : "Host, identità e chiavi SSH vengono salvati sul dispositivo, cifrati."}
        </p>
        {preview && (
          <p className={callout}>
            Anteprima in memoria: usa una password fittizia. Nessun dato viene
            cifrato o conservato dopo il ricaricamento.
          </p>
        )}
        <ErrorBanner />
        {desktop || preview ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              unlock.submit();
            }}
          >
            {unlock.restore && (
              <>
                <label>
                  URL completo del vault remoto
                  <Input
                    required
                    type="url"
                    value={unlock.url}
                    onChange={(e) => unlock.setUrl(e.target.value)}
                    placeholder="https://sync.example.com"
                  />
                </label>
                <label>
                  Token
                  <PasswordInput
                    autoComplete="off"
                    required
                    value={unlock.token}
                    onChange={(e) => unlock.setToken(e.target.value)}
                  />
                </label>
              </>
            )}
            {unlock.restore && (
              <p className={help}>
                Copia l’URL completo dalle impostazioni dell’altro dispositivo,
                incluso /vaults/… quando presente.
              </p>
            )}
            <label>
              Password principale
              <PasswordInput
                autoFocus

                autoComplete={view.exists ? "current-password" : "new-password"}
                minLength={view.exists || unlock.restore ? 1 : 12}
                required
                value={unlock.password}
                onChange={(e) => unlock.setPassword(e.target.value)}
              />
            </label>
            {!view.exists && !unlock.restore && (
              <label>
                Conferma password
                <PasswordInput
                  autoComplete="new-password"
                  required
                  value={unlock.confirmPassword}
                  onChange={(e) => unlock.setConfirmPassword(e.target.value)}
                />
              </label>
            )}
            {desktop && !unlock.restore && (
              <div className="mt-[16px] flex items-center justify-between gap-[12px] text-[13px]">
                Ricorda su questo dispositivo
                <Switch
                  label="Ricorda su questo dispositivo"
                  checked={unlock.remember}
                  onChange={unlock.setRemember}
                />
              </div>
            )}
            <Button
              variant="default"
              type="submit"
              className="mt-[8px] h-[40px] w-full"
              disabled={busy}
            >
              {busy
                ? "Attendi…"
                : view.exists
                  ? "Sblocca"
                  : unlock.restore
                    ? "Collega dispositivo"
                    : "Crea vault"}
            </Button>
          </form>
        ) : (
          <>
            <div className={callout}>
              Prova gli stessi form e le stesse azioni con dati fittizi in
              memoria. SSH e cifratura richiedono l’app desktop.
            </div>
            <Button
              variant="default"
              type="button"
              className="mt-[8px] h-[40px] w-full"
              onClick={vault.startPreview}
            >
              Esplora interfaccia
            </Button>
          </>
        )}
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
        {(desktop || preview) && !view.exists && !unlock.restore && (
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
