import { WindowControls } from "./WindowControls";
import { useApp } from "./app-context";

export function TitleBar() {
  const {
    vault: { setError },
    dnd: {},
  } = useApp();
  return (
    <header
      className="absolute inset-x-0 top-0 flex h-[46px] items-stretch justify-between bg-header select-none"
      data-tauri-drag-region
    >
      <span
        className="flex-1 px-[18px] py-[14px] text-[13px] text-muted-foreground [.mac_&]:hidden"
        data-tauri-drag-region
      >
        Shellnest
      </span>
      <WindowControls onError={setError} />
    </header>
  );
}
