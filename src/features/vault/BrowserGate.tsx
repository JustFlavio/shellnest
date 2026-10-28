import { Button } from "@/components/ui/button";
import { callout } from "@/lib/editor-ui";
import { useApp } from "@/app/app-context";

/** What a plain browser gets instead of the unlock form: the in-memory preview. */
export function BrowserGate() {
  const {
    vault: { startPreview },
  } = useApp();
  return (
    <>
      <div className={callout}>
        Dati fittizi in memoria. SSH e cifratura solo nell’app desktop.
      </div>
      <Button
        variant="default"
        type="button"
        className="mt-[8px] h-[40px] w-full"
        onClick={startPreview}
      >
        Esplora interfaccia
      </Button>
    </>
  );
}
