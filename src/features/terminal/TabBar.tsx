import { TabLead, TabMain, TabShell } from "./Tab";
import { Button } from "@/components/ui/button";
import { Plus, Server, SquarePlus } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/app/app-context";
import { SessionTab } from "./SessionTab";
import { SyncButton } from "@/features/vault/SyncButton";

export function TabBar() {
  const {
    preferences: { hint },
    tabs: {
      tabs,
      bar,
      active,
      setActive,
      launcherOpen,
      detachPane,
      closeLauncher,
      openLauncher,
    },
    dnd: { dragPane, clearSpring, clearDnd },
  } = useApp();
  useEffect(() => {
    document
      .querySelector(".tab.selected")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, tabs.length]);
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-[6px] overflow-x-auto px-[8px] py-[5px]"
      onDragOver={(e) => {
        if (dragPane) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX - r.left < 48) e.currentTarget.scrollLeft -= 14;
        else if (r.right - e.clientX < 48) e.currentTarget.scrollLeft += 14;
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) clearSpring();
      }}
      onDrop={(e) => {
        if (!dragPane) return;
        e.preventDefault();
        detachPane(dragPane);
        clearDnd();
      }}
      role="navigation"
      aria-label="Sessioni e connessioni"
      data-tauri-drag-region
    >
      <TabShell
        fixed
        selected={active === "vault"}
        onClick={() => setActive("vault")}
      >
        <TabLead icon={<Server size={14} />} />
        <TabMain
          aria-current={active === "vault" ? "page" : undefined}
          onClick={() => setActive("vault")}
        >
          Vault
        </TabMain>
      </TabShell>
      {bar.map((tab) => (
        <SessionTab key={tab.id} tab={tab} />
      ))}
      {launcherOpen && (
        <TabShell className="w-[170px]" selected={active === "launcher"}>
          <TabLead
            icon={<SquarePlus size={15} />}
            onClose={closeLauncher}
            label="nuova scheda"
          />
          <TabMain
            aria-current={active === "launcher" ? "page" : undefined}
            onClick={() => setActive("launcher")}
          >
            Nuova scheda
          </TabMain>
        </TabShell>
      )}
      <Button
        variant="ghost"
        type="button"
        className="size-[30px] shrink-0 rounded-[9px] p-0 text-muted-foreground"
        aria-label="Nuova connessione"
        title={["Nuova connessione", hint("quickConnect")]
          .filter(Boolean)
          .join(" · ")}
        onClick={openLauncher}
      >
        <Plus size={18} />
      </Button>
      <span
        className="min-w-[28px] flex-1 self-stretch"
        data-tauri-drag-region
      />
      <SyncButton />
    </div>
  );
}
