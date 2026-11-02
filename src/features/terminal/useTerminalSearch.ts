import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Xterm } from "./xterm";
import { mixHex } from "@/features/settings/app-themes.ts";

// Search highlights in the theme's primary color (the addon only accepts #RRGGBB).
function searchDecorations(terminalBackground = "#000000") {
  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  return {
    matchBackground: mixHex(primary, terminalBackground, 0.35),
    matchOverviewRuler: primary,
    activeMatchBackground: primary,
    activeMatchColorOverviewRuler: primary,
  };
}

export function useTerminalSearch(xterm: RefObject<Xterm | null>) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [noMatch, setNoMatch] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const find = (forward: boolean, incremental = false, text = query) => {
    const addon = xterm.current?.search;
    if (!text) {
      addon?.clearDecorations();
      setNoMatch(false);
      return;
    }
    const options = {
      incremental,
      decorations: searchDecorations(
        xterm.current?.term.options.theme?.background,
      ),
    };
    setNoMatch(
      !(forward
        ? addon?.findNext(text, options)
        : addon?.findPrevious(text, options)),
    );
  };
  const change = (text: string) => {
    setQuery(text);
    find(true, true, text);
  };
  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  const open = () => {
    setSearching(true);
    input.current?.focus();
    input.current?.select();
  };
  const close = () => {
    setSearching(false);
    xterm.current?.search.clearDecorations();
    xterm.current?.term.focus();
  };
  return { searching, query, change, noMatch, input, find, open, close };
}
