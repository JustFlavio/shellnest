import { useApp } from "./app-context";
import { Check } from "lucide-react";

export function NoticeBanner() {
  const {
    vault: { notice },
  } = useApp();
  if (!notice) return null;
  return (
    <div
      className="flex shrink-0 items-center gap-[10px] px-[22px] py-[10px] text-[13px] border-b border-[#76c5a025] bg-[#76c5a012] text-[#9dd5b9]"
      role="status"
    >
      <Check size={14} />
      {notice}
    </div>
  );
}

export function PreviewBanner() {
  return (
    <div className="border-b border-[#c99b4920] bg-[#c99b4910] px-[22px] py-[6px] text-[12px] text-[#c4af83]">
      Anteprima interattiva · Usa dati fittizi · Modifiche azzerate al
      ricaricamento
    </div>
  );
}
