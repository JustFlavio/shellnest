import {
  AlertDialog,
  AlertDialogDescription,
} from "./components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "./components/ui/dialog";
import { SelectField } from "./SelectField";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { PasswordInput } from "./PasswordInput";
import { Textarea } from "./components/ui/textarea";
import { useRef, useState } from "react";
import {
  X,
  Plus,
  Upload,
  PanelRightClose,
  Folder,
  UserRound,
  KeyRound,
  LockKeyhole,
  Server,
  Pencil,
  Check,
  LoaderCircle,
  AlertCircle,
  ContactRound,
} from "lucide-react";
import { OsIcon } from "./OsIcon";
import { cn } from "./lib/utils";
import type { HostDraft, View, IdentityForm, KeyForm } from "./types";
import type { ReactNode } from "react";
import { HostPasswordInput } from "./HostPasswordInput";
import { HostCredentialsField } from "./HostCredentialsField";
import { hostDraftIsDirty, hostDraftIsValid } from "./host-draft";
import { GroupField } from "./GroupField";
import { groupPath, inheritedIdentity, portSource } from "./groups.mjs";
import {
  addressIcon,
  callout,
  divider,
  errorBox,
  fingerprint,
  help,
  inheritedBox,
  portInline,
  section,
  sectionHelp,
  sheetField,
  subheading,
  vaultBar,
} from "./editor-ui";

// Panel look per variant. Children (forms, footers, paragraphs) are styled from
// here because the call sites hand over plain markup.
const panelFooterBase =
  "[&>footer]:sticky [&>footer]:bottom-[-16px] [&>footer]:z-2 [&>footer]:-mx-[16px] [&>footer]:mt-auto [&>footer]:-mb-[16px] [&>footer]:flex [&>footer]:justify-end [&>footer]:gap-[8px] [&>footer]:border-t [&>footer]:border-border [&>footer]:bg-sidebar [&>footer]:px-[16px] [&>footer]:py-[14px] " +
  "[&>form>footer]:sticky [&>form>footer]:bottom-[-16px] [&>form>footer]:z-2 [&>form>footer]:-mx-[16px] [&>form>footer]:mt-auto [&>form>footer]:-mb-[16px] [&>form>footer]:flex [&>form>footer]:justify-end [&>form>footer]:gap-[8px] [&>form>footer]:border-t [&>form>footer]:border-border [&>form>footer]:bg-sidebar [&>form>footer]:px-[16px] [&>form>footer]:py-[14px] " +
  "[&_footer_button]:h-[34px] [&_footer_button]:px-[13px] [&_footer_.primary]:flex-1";
const panelBodyBase =
  "min-h-0 flex-1 overflow-auto p-[16px] [&>form]:flex [&>form]:min-h-full [&>form]:flex-col [&>form]:gap-[14px] [&>form>label]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.7] " +
  panelFooterBase;
const panelStyles = {
  sheet: {
    // A nested dialog has no backdrop of its own, so the sheet's backdrop dims
    // the page once a centered panel or a confirmation sits on top of it.
    overlay:
      "bg-transparent supports-backdrop-filter:backdrop-blur-none [body:has(.centered-panel):not(:has(.alert-panel))_&]:bg-[#080b1026] max-[1100px]:[body:has(.centered-panel):not(:has(.alert-panel))_&]:bg-[#080b1070] [body:has(.alert-panel)_&]:bg-[#04060ccc]",
    content:
      "side-sheet fixed top-[46px] flex flex-col gap-0 p-0 right-0 bottom-0 left-auto h-[calc(100dvh-46px)] w-[var(--sheet-width)] max-w-[100vw] translate-x-0 translate-y-0 rounded-none border-0 border-l border-border bg-background shadow-none ring-0 sm:max-w-[100vw] max-[760px]:w-[min(var(--sheet-width),100vw)] [body:not(:has(.app))_&]:top-0 [body:not(:has(.app))_&]:h-dvh data-closed:pointer-events-none data-open:animate-[sheet-in_0.22s_cubic-bezier(0.2,0.7,0.2,1)] " +
      "[&>footer]:flex [&>footer]:shrink-0 [&>footer]:justify-end [&>footer]:gap-[8px] [&>footer]:border-t [&>footer]:border-border [&>footer]:bg-[color-mix(in_srgb,var(--background)_92%,black)] [&>footer]:px-[14px] [&>footer]:py-[12px] " +
      "[&_[data-slot=input]]:rounded-[10px] [&_[data-slot=input]]:text-[14px] [&_[data-slot=select-trigger]]:rounded-[10px] [&_[data-slot=select-trigger]]:text-[14px] [&_footer_button]:h-[34px] [&_footer_button]:rounded-[10px] [&_footer_button]:px-[13px] [&_footer_button]:text-[14px] [&_footer_.primary]:flex-1 " +
      "[&_[data-slot=input]:hover]:border-[color-mix(in_srgb,var(--input),var(--muted-foreground)_35%)] [&_[data-slot=select-trigger]:hover]:border-[color-mix(in_srgb,var(--input),var(--muted-foreground)_35%)]",
    header: "bg-sidebar px-[18px] shadow-[0_1px_0_var(--border)]",
    title: "text-[14px] leading-[1.4]",
    body: panelBodyBase + " [&>form]:min-h-0 [&>form]:gap-[16px]",
  },
  dialog: {
    overlay:
      "bg-[#080b1026] max-[1100px]:bg-[#080b1070] supports-backdrop-filter:backdrop-blur-none",
    content:
      "centered-panel flex w-[480px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] flex-col gap-0 bg-sidebar p-0 sm:max-w-[calc(100vw-32px)] [&_.fingerprint]:[overflow-wrap:anywhere]",
    header: "",
    title: "text-[13px]",
    body:
      panelBodyBase +
      " flex-[0_1_auto] [&>form]:min-h-0 [&>footer]:static [&>footer]:mt-[20px] [&>footer]:flex-wrap [&>form>footer]:static [&>form>footer]:mt-[20px] [&>form>footer]:flex-wrap",
  },
  alert: {
    overlay: "bg-[#04060c99] supports-backdrop-filter:backdrop-blur-none",
    content:
      "centered-panel alert-panel flex w-[440px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] flex-col gap-0 overflow-hidden rounded-[16px] border border-border bg-background p-0 shadow-[0_24px_64px_#0008] ring-0 sm:max-w-[calc(100vw-32px)]",
    header:
      "min-h-[60px] bg-card px-[20px] [&_button]:size-[32px] [&_button]:text-foreground [&_button_svg]:!size-[20px]",
    title: "text-[17px]",
    body:
      "flex-[0_1_auto] px-[20px] pt-[24px] pb-[20px] min-h-0 overflow-auto [&_p]:text-[14px] [&_p]:leading-[1.7] [&_p]:text-foreground [&>[data-slot]]:text-[14px] [&>[data-slot]]:text-foreground " +
      "[&>footer]:mt-[18px] [&>footer]:flex [&>footer]:justify-end [&>footer]:gap-[8px] [&_footer_button]:h-[38px] [&_footer_button]:px-[18px] [&_footer_button]:font-semibold [&_footer_button]:text-[14px] " +
      "[&_footer_.danger]:border-0 [&_footer_.danger]:bg-destructive [&_footer_.danger]:text-[#1a0f0d] [&_footer_.danger:hover:not(:disabled)]:bg-[color-mix(in_srgb,var(--destructive),white_12%)] [&_footer_.primary]:border-0",
  },
} as const;

export function Panel({
  title,
  onClose,
  children,
  error,
  busy,
  className = "",
  dirty = false,
  variant = "sheet",
  footer,
  status,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  error: string;
  busy: boolean;
  className?: string;
  dirty?: boolean;
  variant?: "sheet" | "dialog" | "alert";
  footer?: ReactNode;
  status?: ReactNode;
}) {
  const [discarding, setDiscarding] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const styles = panelStyles[variant];
  const Root = variant === "alert" ? AlertDialog : Dialog;
  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  };
  return (
    <Root
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
      {...(variant === "alert"
        ? {}
        : { disablePointerDismissal: variant !== "sheet" })}
    >
      <DialogContent
        ref={popup}
        className={cn(styles.content, className)}
        overlayClassName={styles.overlay}
        initialFocus={
          variant === "alert"
            ? () =>
                popup.current?.querySelector<HTMLElement>(
                  "[data-alert-cancel]",
                ) ?? true
            : undefined
        }
        showCloseButton={false}
        aria-busy={busy}
      >
        <header
          className={cn(
            "flex min-h-[55px] shrink-0 items-center justify-between gap-[10px] border-b border-border px-[18px] [&_button]:size-[28px] [&_button]:p-0 [&_button]:text-muted-foreground",
            styles.header,
          )}
        >
          <DialogTitle
            render={<h2 />}
            className={cn("mr-auto font-semibold", styles.title)}
          >
            {title}
          </DialogTitle>
          {status}
          <Button
            variant="ghost"
            type="button"
            aria-label="Chiudi pannello"
            onClick={requestClose}
            disabled={busy}
          >
            {variant === "sheet" ? (
              <PanelRightClose className="size-5" />
            ) : (
              <X size={18} />
            )}
          </Button>
        </header>
        <div className={styles.body} inert={busy ? true : undefined}>
          {error && (
            <p className={errorBox} role="alert">
              {error}
            </p>
          )}
          {children}
        </div>
        {footer}
      </DialogContent>
      {discarding && (
        <Panel
          variant="alert"
          title="Scartare le modifiche?"
          busy={busy}
          error=""
          onClose={() => setDiscarding(false)}
        >
          <AlertDialogDescription>
            Le modifiche a questo modulo non sono state salvate.
          </AlertDialogDescription>
          <footer>
            <Button
              variant="destructive"
              className="danger"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Scarta modifiche
            </Button>
          </footer>
        </Panel>
      )}
    </Root>
  );
}
export function EditorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={section}>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
export function HostEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewIdentity,
  onNewGroup,
  busy,
  error,
  saveStatus,
  hasUnsavedChanges,
  onRetrySave,
  onRevealPassword,
}: {
  value: HostDraft;
  onChange: (v: HostDraft) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  onNewIdentity: () => void;
  onNewGroup: (name: string) => void;
  busy: boolean;
  error: string;
  saveStatus?: "idle" | "editing" | "saving" | "saved" | "error";
  hasUnsavedChanges?: boolean;
  onRetrySave?: () => void;
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
  const dirty = hasUnsavedChanges ?? hostDraftIsDirty(value, existing);
  const valid = hostDraftIsValid(value, view.identities, existing, view.groups);
  const StatusIcon =
    saveStatus === "saving"
      ? LoaderCircle
      : saveStatus === "saved"
        ? Check
        : saveStatus === "error"
          ? AlertCircle
          : Pencil;
  const statusLabel =
    saveStatus === "saving"
      ? "Salvataggio in corso"
      : saveStatus === "saved"
        ? "Salvato"
        : saveStatus === "error"
          ? "Salvataggio non riuscito"
          : "Modifiche non salvate";
  return (
    <Panel
      className="host-editor"
      title={
        view.hosts.some((h) => h.id === value.id)
          ? "Modifica host"
          : "Nuovo host"
      }
      {...{ onClose, busy, error }}
      dirty={dirty && (!saveStatus || !valid)}
      status={
        saveStatus && saveStatus !== "idle" ? (
          <span
            role="status"
            className={cn(
              "ml-auto inline-flex items-center text-muted-foreground",
              (saveStatus === "saving" || saveStatus === "saved") &&
                "text-primary",
              saveStatus === "error" && "text-destructive",
            )}
            title={statusLabel}
          >
            <StatusIcon
              className={`size-4 ${saveStatus === "saving" ? "animate-spin" : ""}`}
            />
            <span className="sr-only">{statusLabel}</span>
          </span>
        ) : undefined
      }
      footer={
        <footer>
          {saveStatus === "error" && (
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={onRetrySave}
            >
              Riprova
            </Button>
          )}
          <Button
            variant="default"
            type="submit"
            form="host-editor-form"
            className="primary"
            disabled={busy || !valid}
          >
            Connetti
          </Button>
        </footer>
      }
    >
      <form
        id="host-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className={vaultBar} aria-label="Vault corrente">
          <LockKeyhole className="size-5" aria-hidden="true" />
          <strong>{view.vaultName}</strong>
        </div>
        <EditorSection title="Indirizzo">
          <div className="flex items-center gap-[10px]">
            {value.os ? (
              <OsIcon os={value.os} size="field" />
            ) : (
              <span className={addressIcon}>
                <Server className="size-5" aria-hidden="true" />
              </span>
            )}
            <label className="m-0! min-w-0 flex-1">
              <span className="sr-only">Indirizzo</span>
              <Input
                required
                value={value.address}
                onChange={(e) =>
                  onChange({ ...value, address: e.target.value })
                }
                placeholder="IP o nome host"
              />
            </label>
          </div>
        </EditorSection>
        <EditorSection title="Generale">
          <label className={sheetField}>
            <span className="sr-only">Nome</span>
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Nome dell’host"
            />
          </label>
          <GroupField
            value={value}
            groups={view.groups}
            onChange={onChange}
            onNewGroup={onNewGroup}
          />
        </EditorSection>
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
                  ownPort:
                    e.target.value === "" ? null : Number(e.target.value),
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
          {!value.identityId &&
            !value.inheritIdentity &&
            existing?.hasPassword && (
              <p className={sectionHelp}>
                Lascia vuoto per mantenere la password salvata.
              </p>
            )}
        </fieldset>
      </form>
    </Panel>
  );
}
export function IdentityEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  onNewKey,
  returnTo,
  busy,
  error,
}: {
  value: IdentityForm;
  onChange: (v: IdentityForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  onNewKey: () => void;
  returnTo?: string;
  busy: boolean;
  error: string;
}) {
  const existing = view.identities.find((i) => i.id === value.id);
  const dirty =
    !!value.password ||
    (existing
      ? (["name", "username", "auth", "keyId"] as const).some(
          (key) => value[key] !== existing[key],
        )
      : !!(
          value.name ||
          value.keyId ||
          value.username !== "root" ||
          value.auth !== "key"
        ));
  return (
    <Panel
      title={existing ? "Modifica identità" : "Nuova identità"}
      {...{ onClose, busy, error }}
      dirty={dirty}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo ? "Torna all’host" : "Annulla"}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="identity-editor-form"
            className="primary"
            disabled={busy || (value.auth === "key" && !value.keyId)}
          >
            {returnTo ? "Salva e torna all’host" : "Salva identità"}
          </Button>
        </footer>
      }
    >
      <form
        id="identity-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {returnTo && (
          <p className={help}>
            Stai preparando l’accesso per un nuovo host. Dopo il salvataggio
            tornerai al modulo host, con i dati già inseriti.
          </p>
        )}
        <EditorSection title="Generale">
          <label>
            Nome
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Es. Amministrazione"
            />
          </label>
          <label>
            Utente SSH
            <Input
              required
              value={value.username}
              onChange={(e) => onChange({ ...value, username: e.target.value })}
              placeholder="root"
              autoComplete="off"
            />
          </label>
        </EditorSection>
        <EditorSection title="Accesso SSH">
          <label>
            Metodo
            <SelectField
              aria-label="Metodo di autenticazione"
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
                { value: "key", label: "Chiave SSH" },
                { value: "password", label: "Password" },
              ]}
            />
          </label>
          {value.auth === "key" ? (
            <>
              <label>
                Chiave dal portachiavi
                <SelectField
                  aria-label="Chiave dal portachiavi"
                  required
                  value={value.keyId}
                  onValueChange={(keyId) => onChange({ ...value, keyId })}
                  placeholder="Seleziona una chiave"
                  options={view.keys.map((k) => ({
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
                Importa una chiave
              </Button>
            </>
          ) : (
            <label>
              Password
              <PasswordInput
                autoComplete="new-password"
                required={!existing?.hasPassword}
                value={value.password}
                onChange={(e) =>
                  onChange({ ...value, password: e.target.value })
                }
                placeholder={
                  existing?.hasPassword
                    ? "Lascia vuoto per mantenere quella salvata"
                    : ""
                }
              />
            </label>
          )}
          {existing && existing.hostCount > 0 && (
            <div className={callout}>
              La modifica verrà usata dalle prossime connessioni di{" "}
              {existing.hostCount} host. Le sessioni già aperte restano attive.
            </div>
          )}
          <p className={sectionHelp}>
            Puoi assegnare questa identità a uno o più host. Identità con utenti
            diversi possono usare la stessa chiave.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
export function KeyEditor({
  value,
  onChange,
  view,
  onSubmit,
  onClose,
  busy,
  error,
  returnTo,
}: {
  value: KeyForm;
  onChange: (v: KeyForm) => void;
  view: View;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  returnTo?: string;
}) {
  const existing = view.keys.find((k) => k.id === value.id);
  const file = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");
  return (
    <Panel
      title={existing ? "Modifica chiave SSH" : "Importa chiave SSH"}
      {...{ onClose, busy }}
      error={fileError || error}
      footer={
        <footer>
          <DialogClose
            render={<Button variant="ghost" type="button" disabled={busy} />}
          >
            {returnTo ? "Torna all’identità" : "Annulla"}
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            form="key-editor-form"
            className="primary"
            disabled={busy}
          >
            {returnTo
              ? "Importa e torna all’identità"
              : existing
                ? "Salva chiave"
                : "Importa chiave"}
          </Button>
        </footer>
      }
      dirty={
        !!(
          value.privateKey ||
          value.passphrase ||
          value.name !== (existing?.name ?? "")
        )
      }
    >
      <form
        id="key-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {returnTo && (
          <p className={help}>
            Importa la chiave da usare per questa identità. Il modulo precedente
            conserva i dati già inseriti.
          </p>
        )}
        <EditorSection title="Generale">
          <label>
            Nome
            <Input
              autoFocus
              required
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Es. Chiave personale"
            />
          </label>
          {existing && (
            <>
              <label>
                Impronta pubblica
                <code className={fingerprint}>
                  {existing.fingerprint ||
                    "Non verificata: reimporta la chiave per validarla"}
                </code>
              </label>
              <p className={sectionHelp}>
                Usata da {existing.identityCount} identità e{" "}
                {existing.hostCount} host. Per rinominare la chiave, lascia
                vuoti i campi qui sotto.
              </p>
            </>
          )}
        </EditorSection>
        <EditorSection title="Chiave privata">
          <input
            ref={file}
            type="file"
            tabIndex={-1}
            className="sr-only"
            aria-label="File della chiave privata"
            onChange={async (e) => {
              setFileError("");
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 1024 * 1024)
                  throw new Error("File troppo grande (massimo 1 MB)");
                const text = await f.text();
                onChange({
                  ...value,
                  privateKey: text,
                  name: value.name || f.name,
                });
              } catch (err) {
                setFileError(String(err));
              }
              e.target.value = "";
            }}
          />
          <Button
            variant="ghost"
            type="button"
            onClick={() => file.current?.click()}
          >
            <Upload size={15} />
            Scegli file della chiave privata
          </Button>
          <label>
            {existing
              ? "Sostituisci chiave privata (opzionale)"
              : "Chiave privata"}
            <Textarea
              rows={9}
              spellCheck={false}
              autoComplete="off"
              required={!existing}
              value={value.privateKey}
              onChange={(e) =>
                onChange({ ...value, privateKey: e.target.value })
              }
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </label>
          <label>
            Passphrase della chiave
            <PasswordInput
              autoComplete="new-password"
              value={value.passphrase}
              onChange={(e) =>
                onChange({ ...value, passphrase: e.target.value })
              }
              disabled={!!existing && !value.privateKey}
              placeholder="Se la chiave è protetta"
            />
          </label>
          {existing && value.privateKey && (
            <div className={callout}>
              Sostituire la chiave modifica le prossime connessioni di tutte le
              identità che la utilizzano.
            </div>
          )}
          <p className={sectionHelp}>
            La chiave viene importata nel vault cifrato. Il file originale non
            viene modificato.
          </p>
        </EditorSection>
      </form>
    </Panel>
  );
}
