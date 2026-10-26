import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import { Button } from "./components/ui/button";

export function WindowControls({
  onError,
}: {
  onError: (error: string) => void;
}) {
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
          if (!disposed) onError(String(error));
        });
    update();
    const listening = win.onResized(update).catch((error) => {
      onError(String(error));
    });
    return () => {
      disposed = true;
      void listening
        .then((unlisten) => unlisten?.())
        .catch((error) => onError(String(error)));
    };
  }, [desktop, onError]);
  const act = (action: "minimize" | "toggleMaximize" | "close") => {
    if (desktop)
      void getCurrentWindow()
        [action]()
        .catch((error) => onError(String(error)));
  };
  return (
    <div className="window-controls" aria-label="Controlli finestra">
      <Button
        variant="ghost"
        aria-label="Riduci a icona"
        disabled={!desktop}
        onClick={() => act("minimize")}
      >
        <Minus size={15} />
      </Button>
      <Button
        variant="ghost"
        aria-label={maximized ? "Ripristina finestra" : "Massimizza finestra"}
        disabled={!desktop}
        onClick={() => act("toggleMaximize")}
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </Button>
      <Button
        variant="ghost"
        className="window-close"
        aria-label="Chiudi finestra"
        disabled={!desktop}
        onClick={() => act("close")}
      >
        <X size={17} />
      </Button>
    </div>
  );
}
