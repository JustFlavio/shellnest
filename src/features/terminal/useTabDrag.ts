import { useEffect, useRef, useState } from "react";
import type { Edge } from "./workbench-state.ts";
import type { TabsApi } from "./useTabs";
import { layoutRects, removeLeaf } from "./workbench-state.ts";

/** Dragging a tab over the bar or a pane over its workspace, and the geometry shown meanwhile. */
export function useTabDrag({ tabs, active, setActive, dropOnPane }: TabsApi) {
  const [drag, setDrag] = useState<{
      id: string;
      over?: string;
      after?: boolean;
    }>(),
    [dragPane, setDragPane] = useState<string>(),
    [dropHint, setDropHint] = useState<{ paneId: string; edge: Edge | null }>(),
    // While a pane is dragged, the others close ranks after a short delay, as if it had left.
    [reflow, setReflow] = useState(false),
    [settling, setSettling] = useState(false);
  const spring = useRef<{ id: string; timer: number } | undefined>(undefined);
  const clearSpring = () => {
    window.clearTimeout(spring.current?.timer);
    spring.current = undefined;
  };
  const clearDnd = () => {
    clearSpring();
    setDrag(undefined);
    setDragPane(undefined);
    setDropHint(undefined);
  };
  // Hover a dragged tab over another one to open it, so it can be dropped on its panes.
  const springOpen = (id: string) => {
    if (drag?.id === id || spring.current?.id === id) return;
    clearSpring();
    spring.current = {
      id,
      timer: window.setTimeout(() => setActive(id), 500),
    };
  };
  const dropOn = (targetId: string, edge: Edge) => {
    const srcId = dragPane ?? drag?.id;
    if (srcId) dropOnPane(srcId, !!dragPane, targetId, edge);
  };
  const [settledFor, setSettledFor] = useState(dragPane);
  if (dragPane !== settledFor) {
    setSettledFor(dragPane);
    if (dragPane) setSettling(true);
    else setReflow(false);
  }
  useEffect(() => {
    const timer = dragPane
      ? window.setTimeout(() => setReflow(true), 150)
      : window.setTimeout(() => setSettling(false), 300);
    return () => window.clearTimeout(timer);
  }, [dragPane]);
  const geos = new Map(
    tabs.flatMap((t) =>
      t.layout ? [[t.id, layoutRects(t.layout)] as const] : [],
    ),
  );
  // Geometry on screen: without the dragged pane once the others have closed ranks.
  const shown = new Map(geos);
  if (reflow && dragPane) {
    const leader = tabs.find((t) => t.id === dragPane)?.parent ?? dragPane;
    const layout = tabs.find((t) => t.id === leader)?.layout;
    const rest = layout && removeLeaf(layout, dragPane);
    if (rest) shown.set(leader, layoutRects(rest));
  }
  return {
    drag,
    setDrag,
    dragPane,
    setDragPane,
    dropHint,
    setDropHint,
    reflow,
    settling,
    clearSpring,
    clearDnd,
    springOpen,
    dropOn,
    geos,
    shown,
    dragging: !!dragPane || (!!drag?.id && drag.id !== active),
  };
}
