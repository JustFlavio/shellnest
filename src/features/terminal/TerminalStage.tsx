import { useTranslation } from "react-i18next";
import { TerminalPane } from "./TerminalPane";
import { cn } from "@/lib/utils";
import { notifyError } from "@/lib/notify";
import { dropEdge } from "./workbench-state.ts";
import { useRef } from "react";
import { useApp } from "@/app/app-context";

const dropPreviewEdge = {
  left: "inset-y-0 right-1/2 left-0",
  right: "inset-y-0 right-0 left-1/2",
  top: "inset-x-0 top-0 bottom-1/2",
  bottom: "inset-x-0 top-1/2 bottom-0",
} as const;

export function TerminalStage() {
  const { t } = useTranslation();
  const {
    vault: { view },
    preferences: { appSettings },
    tabs: {
      tabs,
      bar,
      active,
      setFocusedPane,
      focusOf,
      connect,
      askClosePane,
      openLocal,
      startQuick,
      resizeActive,
      tabStatus,
      tabTitle,
      closePane,
      reconnectPane,
      duplicateTab,
    },
    dnd: {
      dragPane,
      setDragPane,
      dropHint,
      setDropHint,
      reflow,
      settling,
      clearDnd,
      dropOn,
      geos,
      shown,
      dragging,
    },
    library: { editHostFromTab },

    vault,
  } = useApp();
  const terminals = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={terminals}
      className={cn(
        "relative min-h-0 flex-1",
        geos.get(active) && "mx-[4px] mb-[4px]",
      )}
      style={{
        display: bar.some((t) => t.id === active) ? "block" : "none",
      }}
    >
      {tabs.map((tab) => {
        const leader = tab.parent ?? tab.id,
          geo = geos.get(leader),
          focus = focusOf(tabs.find((t) => t.id === leader) ?? tab);
        return (
          <TerminalPane
            key={tab.id}
            tab={tab}
            active={active === leader}
            box={
              tab.id === dragPane
                ? geo?.panes[tab.id]
                : (shown.get(leader)?.panes[tab.id] ?? geo?.panes[tab.id])
            }
            ghost={tab.id === dragPane && reflow}
            animate={settling}
            settings={appSettings}
            focused={geo ? focus === tab.id : undefined}
            onFocus={geo ? () => setFocusedPane(tab.id) : undefined}
            onDragPane={
              geo ? (on) => setDragPane(on ? tab.id : undefined) : undefined
            }
            onError={(message) =>
              notifyError(t("terminal.terminalStage.terminalProblem"), message)
            }
            onStatus={tabStatus}
            onTitle={tabTitle}
            onMetadata={vault.refresh}
            onClose={() => askClosePane(tab.id)}
            onReconnect={() => duplicateTab(tab, true)}
            onRetry={() => {
              if (geo) return reconnectPane(tab.id);
              closePane(tab.id);
              if (tab.kind === "ssh") {
                const host = view.hosts.find((h) => h.id === tab.host.id);
                if (host) connect(host);
              } else if (tab.kind === "local") openLocal();
              else
                startQuick({
                  ...tab.target,
                  username: tab.username || undefined,
                });
            }}
            onEdit={
              tab.kind === "ssh"
                ? () => {
                    const host = view.hosts.find((h) => h.id === tab.host.id);
                    if (host) editHostFromTab(host);
                  }
                : undefined
            }
          />
        );
      })}
      {dragging &&
        Object.entries(
          shown.get(active)?.panes ?? {
            [active]: { x: 0, y: 0, w: 1, h: 1 },
          },
        ).map(([id, box]) =>
          id === dragPane ? null : (
            <div
              key={id}
              className="absolute z-3"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const r = e.currentTarget.getBoundingClientRect(),
                  edge = dropEdge(
                    e.clientX - r.left,
                    e.clientY - r.top,
                    r.width,
                    r.height,
                  );
                setDropHint((h) =>
                  h?.paneId === id && h.edge === edge
                    ? h
                    : { paneId: id, edge },
                );
              }}
              onDragLeave={() => setDropHint(undefined)}
              onDrop={(e) => {
                e.preventDefault();
                if (dropHint?.paneId === id && dropHint.edge)
                  dropOn(id, dropHint.edge);
                clearDnd();
              }}
            >
              {dropHint?.paneId === id && dropHint.edge && (
                <div
                  className={cn(
                    "pointer-events-none absolute rounded-[8px] border-2 border-primary bg-[color-mix(in_oklab,var(--primary)_22%,transparent)]",
                    dropPreviewEdge[dropHint.edge],
                  )}
                />
              )}
            </div>
          ),
        )}
      {shown.get(active)?.dividers.map((d) => (
        <div
          key={d.path}
          className={cn(
            // A wide invisible hit area; on hover a small grip appears in the gap.
            "absolute z-2 after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-foreground/70 after:opacity-0 after:transition-opacity after:duration-150 after:content-[''] hover:after:opacity-100 active:after:opacity-100 active:after:bg-primary",
            d.dir === "row"
              ? "-ml-[6px] w-[12px] cursor-col-resize after:h-[44px] after:w-[4px]"
              : "-mt-[6px] h-[12px] cursor-row-resize after:h-[4px] after:w-[44px]",
          )}
          style={
            d.dir === "row"
              ? {
                  left: `${d.at * 100}%`,
                  top: `${d.box.y * 100}%`,
                  height: `${d.box.h * 100}%`,
                }
              : {
                  top: `${d.at * 100}%`,
                  left: `${d.box.x * 100}%`,
                  width: `${d.box.w * 100}%`,
                }
          }
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const r = terminals.current!.getBoundingClientRect(),
              row = d.dir === "row",
              pos = row
                ? (e.clientX - r.left) / r.width
                : (e.clientY - r.top) / r.height,
              ratio =
                (pos - (row ? d.box.x : d.box.y)) / (row ? d.box.w : d.box.h);
            resizeActive(d.path, ratio);
          }}
        />
      ))}
    </div>
  );
}
