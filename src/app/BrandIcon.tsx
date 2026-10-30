import { cn } from "@/lib/utils";
import appIcon from "../../src-tauri/icons/128x128.png";

export function BrandIcon({ className }: { className?: string }) {
  return (
    <img
      src={appIcon}
      alt=""
      className={cn("block size-[25px] shrink-0 object-contain", className)}
    />
  );
}
