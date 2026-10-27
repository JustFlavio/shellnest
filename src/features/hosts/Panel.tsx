import {
  AlertDialog,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { X, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentOpener } from "@/lib/opener";
import type { ReactNode } from "react";
import { errorBox } from "@/lib/editor-ui";
import { panelStyles } from "./panel-styles";

// Sheets reserve a grid column through a body class: WebKit does not reliably
// re-evaluate a `body:has(.side-sheet)` rule once the portalled sheet is removed.
let openSheets = 0;

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
  const [opener] = useState(currentOpener);
  const styles = panelStyles[variant];
  useEffect(() => {
    if (variant !== "sheet") return;
    openSheets++;
    document.body.classList.add("sheet-open");
    return () => {
      if (!--openSheets) document.body.classList.remove("sheet-open");
    };
  }, [variant]);
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
        finalFocus={() => (opener?.isConnected ? opener : true)}
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
