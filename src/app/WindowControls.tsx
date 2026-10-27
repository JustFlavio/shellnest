import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const onError = (error: unknown) =>
  notifyError("Operazione sulla finestra non riuscita", error);

const control =
  "h-full w-[42px] rounded-none p-0 text-muted-foreground max-[760px]:w-[36px]";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const desktop = isTauri();
  useEffect(() => {
    if (!desktop) return;
    const win = getCurrentWindow();
    let disposed = false;
    const update = () =>
      void win
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value);
        })
        .catch((error) => {
          if (!disposed) onError(error);
        });
    update();
    const listening = win.onResized(update).catch((error) => {
      onError(error);
    });
    return () => {
      disposed = true;
      void listening.then((unlisten) => unlisten?.()).catch(onError);
    };
  }, [desktop]);
  const act = (action: "minimize" | "toggleMaximize" | "close") => {
    if (desktop) void getCurrentWindow()[action]().catch(onError);
  };
  return (
    <div
      className="flex shrink-0 items-stretch [.mac_&]:hidden"
      aria-label="Controlli finestra"
    >
      <Button
        variant="ghost"
        className={control}
        aria-label="Riduci a icona"
        disabled={!desktop}
        onClick={() => act("minimize")}
      >
        <Minus size={15} />
      </Button>
      <Button
        variant="ghost"
        className={control}
        aria-label={maximized ? "Ripristina finestra" : "Massimizza finestra"}
        disabled={!desktop}
        onClick={() => act("toggleMaximize")}
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </Button>
      <Button
        variant="ghost"
        className={cn(control, "hover:bg-[#c42b38] hover:text-white")}
        aria-label="Chiudi finestra"
        disabled={!desktop}
        onClick={() => act("close")}
      >
        <X size={17} />
      </Button>
    </div>
  );
}
