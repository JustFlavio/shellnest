import type { KeyboardEvent } from "react";
import type { Host } from "@/lib/types";

export type HostActions = {
  onConnect: (host: Host) => void;
  onEdit: (host: Host) => void;
  onDuplicate: (host: Host) => void;
  onAssign: (host: Host) => void;
  onDelete: (host: Host) => void;
  onError: (error: string) => void;
};

export const endpoint = (h: Host) =>
  h.address + (h.port === 22 ? "" : ":" + h.port);

/** Enter connects, Space selects; ignores keys bubbling up from inner buttons. */
export function hostKeyDown(
  h: Host,
  e: KeyboardEvent,
  busy: boolean,
  onConnect: (host: Host) => void,
  onSelect: (host: Host, e: KeyboardEvent) => void,
) {
  if (e.target !== e.currentTarget || busy) return;
  if (e.key === "Enter") {
    e.preventDefault();
    onConnect(h);
  }
  if (e.key === " ") {
    e.preventDefault();
    onSelect(h, e);
  }
}
