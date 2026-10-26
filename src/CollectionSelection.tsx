import { useRef, useState, type ReactNode } from "react";

type Selection = { hosts: Set<string>; folders: Set<string> };
type Point = { x: number; y: number };

export function selectionBounds(start: Point, end: Point) {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

export function selectInRectangle(
  bounds: ReturnType<typeof selectionBounds>,
  items: Iterable<{
    id: string;
    folder: boolean;
    rect: ReturnType<typeof selectionBounds>;
  }>,
  initial: Selection,
) {
  const next = {
    hosts: new Set(initial.hosts),
    folders: new Set(initial.folders),
  };
  for (const { id, folder, rect } of items) {
    if (
      rect.right > bounds.left &&
      rect.left < bounds.right &&
      rect.bottom > bounds.top &&
      rect.top < bounds.bottom
    ) {
      next[folder ? "folders" : "hosts"].add(id);
    }
  }
  return next;
}

export function CollectionSelection({
  children,
  selected,
  onSelect,
  busy,
}: {
  children: ReactNode;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  busy: boolean;
}) {
  const drag = useRef<{
    start: Point;
    before: Selection;
    additive: boolean;
    moved: boolean;
  } | null>(null);
  const [box, setBox] = useState<ReturnType<typeof selectionBounds> | null>(
    null,
  );
  return (
    <div
      className="host-collection"
      onPointerDown={(e) => {
        // Portaled menus bubble through React: their clicks must reach them.
        if (
          busy ||
          !e.currentTarget.contains(e.target as Node) ||
          e.button !== 0 ||
          e.pointerType === "touch" ||
          (e.target as HTMLElement).closest(
            "button, a, input, [data-selection-id]",
          )
        )
          return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          start: { x: e.clientX, y: e.clientY },
          before: selected,
          additive: e.ctrlKey || e.metaKey,
          moved: false,
        };
        if (!drag.current.additive)
          onSelect({ hosts: new Set(), folders: new Set() });
      }}
      onPointerMove={(e) => {
        const gesture = drag.current;
        if (!gesture || busy) return;
        if (
          !gesture.moved &&
          Math.hypot(e.clientX - gesture.start.x, e.clientY - gesture.start.y) <
            5
        )
          return;
        gesture.moved = true;
        const bounds = selectionBounds(gesture.start, {
          x: e.clientX,
          y: e.clientY,
        });
        setBox(bounds);
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>("[data-selection-id]"),
          (item) => ({
            id: item.dataset.selectionId!,
            folder: item.dataset.selectionKind === "folder",
            rect: item.getBoundingClientRect(),
          }),
        );
        onSelect(
          selectInRectangle(
            bounds,
            items,
            gesture.additive
              ? gesture.before
              : { hosts: new Set(), folders: new Set() },
          ),
        );
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        drag.current = null;
        setBox(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        if (drag.current) onSelect(drag.current.before);
        drag.current = null;
        setBox(null);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setBox(null);
      }}
    >
      {children}
      {box && (
        <div
          aria-hidden="true"
          className="selection-box"
          style={{
            left: box.left,
            top: box.top,
            width: box.right - box.left,
            height: box.bottom - box.top,
          }}
        />
      )}
    </div>
  );
}
