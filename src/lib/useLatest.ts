import { useLayoutEffect, useRef } from "react";

/** Ref that always holds the value of the last committed render, readable from handlers and timers. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
