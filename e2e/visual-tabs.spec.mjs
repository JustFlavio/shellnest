import { test, expect } from "@playwright/test";

test("long tab titles truncate and actions remain available at narrow widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("option", { name: /api-01/ }).click();
  const nav = page.getByRole("navigation", { name: "Sessioni e connessioni" });
  const session = nav.locator("[draggable=true]").first();
  await session.getByRole("button", { name: "api-01", exact: true }).dblclick();
  const title = "flavio@server-produzione-con-un-nome-molto-lungo:~/applicazioni/shellnest";
  await page.getByRole("textbox", { name: "Nome scheda" }).fill(title);
  await page.keyboard.press("Enter");
  const label = session.getByRole("button", { name: title, exact: true });
  await expect(label).toHaveAttribute("title", title);
  await expect(label.locator("span")).toHaveCSS("text-overflow", "ellipsis");
  expect(await label.locator("span").evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  await nav.getByRole("button", { name: "Vault", exact: true }).click();
  await page.mouse.move(0, 799);
  const actions = session.getByRole("button", { name: /^Azioni scheda/ });
  await expect(actions).toHaveCSS("opacity", "0");
  await session.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await actions.focus();
  await page.mouse.move(0, 799);
  await expect(actions).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Rinomina", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await label.click();
    // The tab strip scrolls horizontally when all sessions cannot fit.
    await session.scrollIntoViewIfNeeded();
    await expect(label).toBeInViewport();
    await expect(session.getByRole("button", { name: `Chiudi ${title}`, exact: true })).toBeInViewport();
    await expect(actions).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.mouse.move(0, 799);
    await page.screenshot({ path: `artifacts/tabs-${width}.png`, clip: { x: 0, y: 0, width, height: 100 } });
  }
});
