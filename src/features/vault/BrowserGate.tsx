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
        Prova gli stessi form e le stesse azioni con dati fittizi in memoria.
        SSH e cifratura richiedono l’app desktop.
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
