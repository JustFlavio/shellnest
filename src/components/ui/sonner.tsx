import { useEffect } from "react";
import { toast, Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { useTheme } from "@/lib/use-theme";

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme();
  // Sonner only collapses the stack on Esc; with focus inside it, Esc should dismiss.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        document.activeElement?.closest("[data-sonner-toaster]")
      )
        toast.dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      visibleToasts={3}
      closeButton
      containerAriaLabel="Notifiche"
      className="toaster group [body.sheet-open_&]:[--toast-right:calc(var(--sheet-width)+24px)]"
      // Keeps the stack clear of the editor sheet, whose save button sits at the bottom right.
      offset={{ right: "var(--toast-right, 24px)", bottom: 24 }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--error-bg":
            "color-mix(in oklab, var(--destructive) 12%, var(--popover))",
          "--error-text": "var(--popover-foreground)",
          "--error-border":
            "color-mix(in oklab, var(--destructive) 40%, var(--border))",
          "--border-radius": "var(--radius)",
          fontFamily: "var(--font-ui)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
          closeButton:
            "!border-border !bg-popover !text-popover-foreground hover:!bg-accent",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
