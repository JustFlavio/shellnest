import { useEffect, useRef, useState } from "react";

/** Copies text to the clipboard; `copied` stays true for a moment afterwards. */
export function useCopied(ms = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = (text: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), ms);
      })
      .catch(() => {});
  return { copied, copy };
}
