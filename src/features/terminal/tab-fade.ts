const FADE_PX = 32;

// Which edges of a horizontal scroller hide content; the 1px slack absorbs fractional scroll positions.
export function hiddenEdges(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): { left: boolean; right: boolean } {
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

// Mask that fades only the edges with hidden content; undefined when everything fits.
export function fadeMask(edges: {
  left: boolean;
  right: boolean;
}): string | undefined {
  if (!edges.left && !edges.right) return undefined;
  const from = edges.left ? "transparent" : "#000";
  const to = edges.right ? "transparent" : "#000";
  return `linear-gradient(to right, ${from}, #000 ${edges.left ? FADE_PX : 0}px, #000 calc(100% - ${edges.right ? FADE_PX : 0}px), ${to})`;
}
