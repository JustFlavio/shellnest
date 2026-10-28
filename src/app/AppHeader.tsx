import { BrandIcon } from "./BrandIcon";
import { WindowControls } from "./WindowControls";
import { AppMenu } from "./AppMenu";
import { TabBar } from "@/features/terminal/TabBar";

export function AppHeader() {
  return (
    <header
      className="col-span-full flex min-w-0 items-stretch border-b border-border bg-header select-none"
      data-tauri-drag-region
      data-app-header
    >
      <div
        className="flex w-[var(--sidebar-width)] shrink-0 items-center gap-[9px] px-[16px] text-[13px] font-semibold whitespace-nowrap [.mac_&]:w-[82px]"
        data-tauri-drag-region
      >
        <BrandIcon className="[.mac_&]:hidden" />
        <span
          className="overflow-hidden text-[13px] text-ellipsis max-[760px]:hidden [.mac_&]:hidden"
          data-tauri-drag-region
        >
          Shellnest
        </span>
      </div>
      <TabBar />
      <AppMenu />
      <WindowControls />
    </header>
  );
}
