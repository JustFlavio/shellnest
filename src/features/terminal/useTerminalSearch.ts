import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Xterm } from "./xterm";

// Search highlights (the addon only accepts #RRGGBB).
const searchDecorations = {
  matchBackground: "#5a4311",
  matchOverviewRuler: "#f5a524",
  activeMatchBackground: "#f5a524",
  activeMatchColorOverviewRuler: "#f5a524",
};

/** In-terminal search state; the bar itself is TerminalSearchBar. */
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
    const options = { incremental, decorations: searchDecorations };
    setNoMatch(
      !(forward
        ? addon?.findNext(text, options)
        : addon?.findPrevious(text, options)),
    );
  };
  // The match follows the typing.
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
