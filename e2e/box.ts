import type { Locator } from "@playwright/test";

/** The element's bounding box, failing the test when it is not on screen. */
export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box");
  return box;
}
