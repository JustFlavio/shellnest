import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/IconButton";

export function Stepper({
  value,
  min,
  max,
  step,
  decrease,
  increase,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  decrease: string;
  increase: string;
  onChange: (value: number) => void;
}) {
  // Rounded so repeated 0.05 steps do not drift.
  const move = (by: number) =>
    onChange(
      Math.min(max, Math.max(min, Math.round((value + by) * 100) / 100)),
    );
  return (
    <div className="flex items-center gap-[6px]">
      <IconButton
        label={decrease}
        variant="outline"
        disabled={value <= min}
        onClick={() => move(-step)}
      >
        <Minus size={14} />
      </IconButton>
      <span className="w-[36px] text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <IconButton
        label={increase}
        variant="outline"
        disabled={value >= max}
        onClick={() => move(step)}
      >
        <Plus size={14} />
      </IconButton>
    </div>
  );
}
