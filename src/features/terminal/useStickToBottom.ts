import { useEffect, useRef } from "react";
import { atBottom } from "./connection-log.ts";

/** Keeps a scrolling list at its end while it grows, unless the user scrolled up to read. */
export function useStickToBottom<T extends HTMLElement>(length: number) {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [length]);
  const onScroll = () => {
    const el = ref.current;
    if (el)
      pinned.current = atBottom(el.scrollTop, el.clientHeight, el.scrollHeight);
  };
  return { ref, onScroll };
}
