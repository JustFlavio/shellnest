import { useTranslation } from "react-i18next";
import { TabLead, TabMain, TabShell } from "./Tab";
import { Button } from "@/components/ui/button";
import { Plus, Server, SquarePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fadeMask, hiddenEdges } from "./tab-fade.ts";
import { useApp } from "@/app/app-context";
import { SessionTab } from "./SessionTab";

export function TabBar() {
  const { t } = useTranslation();
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
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const el = strip.current;
    if (el)
      setEdges(hiddenEdges(el.scrollLeft, el.scrollWidth, el.clientWidth));
  };
  useEffect(() => {
    strip.current?.querySelector("[data-selected]")?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    measure();
  }, [active, tabs.length, launcherOpen]);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    return () => ro.disconnect();
  }, [bar.length, launcherOpen]);
  const mask = fadeMask(edges);
  return (
    <nav
      className="flex min-w-0 flex-1 items-center gap-[6px] px-[8px] py-[5px]"
      onDragOver={(e) => {
        if (dragPane) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
        const el = strip.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (e.clientX - r.left < 48) el.scrollLeft -= 14;
        else if (r.right - e.clientX < 48) el.scrollLeft += 14;
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
      aria-label={t("terminal.tabBar.sessionsAndConnections")}
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
          {t("vault.vaultList.vault")}
        </TabMain>
      </TabShell>
      <div
        ref={strip}
        className="flex min-w-0 items-center gap-[6px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        onScroll={measure}
      >
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
              {t("terminal.connectionLauncher.newTab")}
            </TabMain>
          </TabShell>
        )}
      </div>
      <Button
        variant="ghost"
        type="button"
        className="size-[30px] shrink-0 rounded-[9px] p-0 text-muted-foreground"
        aria-label={t("terminal.tabBar.newConnection")}
        title={[t("terminal.tabBar.newConnection"), hint("quickConnect")]
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
    </nav>
  );
}
