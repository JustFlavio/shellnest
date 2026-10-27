import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KeyForm } from "@/lib/types";

const MAX_KEY_FILE_BYTES = 1024 * 1024;

export function KeyFilePicker({
  value,
  onChange,
  onError,
}: {
  value: KeyForm;
  onChange: (v: KeyForm) => void;
  onError: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={file}
        type="file"
        tabIndex={-1}
        className="sr-only"
        aria-label="File della chiave privata"
        onChange={async (e) => {
          onError("");
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > MAX_KEY_FILE_BYTES)
              throw new Error("File troppo grande (massimo 1 MB)");
            const text = await f.text();
            onChange({
              ...value,
              privateKey: text,
              name: value.name || f.name,
            });
          } catch (err) {
            onError(String(err));
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
    </>
  );
}
