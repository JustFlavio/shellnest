import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_FONT_SIZE, MIN_FONT_SIZE, clampFontSize } from "./settings.ts";

export function FontSizeControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    <div className="flex items-center gap-[6px]">
      <Button
        variant="outline"
        size="icon-sm"
        type="button"
        aria-label="Riduci testo"
        disabled={value <= MIN_FONT_SIZE}
        onClick={() => onChange(clampFontSize(value - 1))}
      >
        <Minus size={14} />
      </Button>
      <span className="w-[28px] text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        type="button"
        aria-label="Ingrandisci testo"
        disabled={value >= MAX_FONT_SIZE}
        onClick={() => onChange(clampFontSize(value + 1))}
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}
