import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createContext, use, useEffect, useRef, useState } from "react";
import { X, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentOpener } from "@/lib/opener";
import type { ReactNode } from "react";
import { errorBox } from "@/lib/editor-ui";
import { panelStyles } from "./panel-styles";

// Open panels are tracked through body classes (`sheet-open`, `dialog-open`,
// `alert-open`): WebKit does not reliably re-evaluate a `body:has(...)` rule once
// a portalled panel is removed, which left the sheet backdrop dark after a
// confirmation closed. Sheets also use the class to reserve a grid column.
const openPanels: Record<string, number> = {};

/**
 * Panels that outlive the page they were opened from (the editors). While
 * `hidden` they stay mounted, so scroll and field state survive a visit to
 * another tab, and the tab strip above the sheet stays clickable.
 */
export const BackgroundPanels = createContext<{ hidden: boolean } | null>(null);

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
  const { t } = useTranslation();
  const [discarding, setDiscarding] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  const [opener] = useState(currentOpener);
  const styles = panelStyles[variant];
  const background = use(BackgroundPanels);
  const hidden = background?.hidden ?? false;
  // A hidden sheet stays open but invisible: closing it would drop its scroll offset.
  const resident = !!background && variant === "sheet";
  useEffect(() => {
    if (hidden) return;
    const cls = `${variant}-open`;
    openPanels[cls] = (openPanels[cls] ?? 0) + 1;
    document.body.classList.add(cls);
    return () => {
      if (!--openPanels[cls]) document.body.classList.remove(cls);
    };
  }, [variant, hidden]);
  const Root = variant === "alert" ? AlertDialog : Dialog;
  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscarding(true);
    else onClose();
  };
  return (
    <Root
      open={resident || !hidden}
      // The modal blocker would cover the tab strip; the overlay still shields the page.
      {...(resident ? { modal: false } : {})}
      onOpenChange={(open, details) => {
        if (open || hidden) return;
        // Pressing the tab strip is navigation, not a request to close the form.
        if (
          background &&
          (details.reason === "focus-out" ||
            (details.reason === "outside-press" &&
              details.event.target instanceof Element &&
              details.event.target.closest("[data-app-header]")))
        )
          return;
        requestClose();
      }}
      {...(variant === "alert"
        ? {}
        : { disablePointerDismissal: variant !== "sheet" })}
    >
      <DialogContent
        ref={popup}
        className={cn(styles.content, className, hidden && "invisible")}
        overlayClassName={cn(
          styles.overlay,
          resident && "top-[46px]",
          hidden && "invisible",
        )}
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
          <DialogTitle className={cn("mr-auto font-semibold", styles.title)}>
            {title}
          </DialogTitle>
          {status}
          <Button
            variant="ghost"
            type="button"
            aria-label={t("hosts.panel.closePanel")}
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
          title={t("hosts.panel.discardTheChanges")}
          busy={busy}
          error=""
          onClose={() => setDiscarding(false)}
        >
          <AlertDialogDescription>
            {t("hosts.panel.theChangesToThis")}
          </AlertDialogDescription>
          <footer>
            <Button
              variant="destructive"
              className="danger"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              {t("hosts.panel.discardChanges")}
            </Button>
          </footer>
        </Panel>
      )}
    </Root>
  );
}
