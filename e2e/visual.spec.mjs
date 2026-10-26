import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  // Park the pointer in an empty corner so no hover state leaks into shots.
  await page.mouse.move(1275, 795);
});

const shot = (page, name) =>
  expect(page).toHaveScreenshot(name + ".png", { fullPage: false });

test("hosts as cards", async ({ page }) => {
  await shot(page, "hosts-cards");
});

test("hosts as list", async ({ page }) => {
  await page.getByRole("button", { name: "Lista" }).click();
  await shot(page, "hosts-list");
});

test("new-host menu", async ({ page }) => {
  await page.getByRole("button", { name: "Altre azioni di creazione" }).click();
  await page.getByRole("menuitem", { name: /Nuova cartella/ }).waitFor();
  await shot(page, "new-host-menu");
});

test("identities and keys", async ({ page }) => {
  await page.getByRole("button", { name: "Identità" }).first().click();
  await page.getByRole("heading", { name: "Identità", level: 1 }).waitFor();
  await shot(page, "identities");
  await page.getByRole("button", { name: "Chiavi SSH" }).first().click();
  await page.getByRole("heading", { name: "Chiavi SSH", level: 1 }).waitFor();
  await shot(page, "keys");
});

test("host editor and discard dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: /host/i }).first().waitFor();
  await shot(page, "host-editor");
  await page.getByRole("textbox").first().fill("prova");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
  await page.getByRole("heading", { name: "Scartare le modifiche?" }).waitFor();
  await shot(page, "discard-dialog");
});

test("quick connect launcher", async ({ page }) => {
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("combobox", { name: "Cerca host o schede" }).waitFor();
  await shot(page, "launcher");
});

test("narrow window collapses the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 700 });
  await shot(page, "narrow");
});

test("shortcuts dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Menu applicazione" }).click();
  await page.getByRole("menuitem", { name: "Scorciatoie da tastiera" }).click();
  await page.getByRole("heading", { name: "Scorciatoie da tastiera" }).waitFor();
  await shot(page, "shortcuts");
});

test("new identity sheet", async ({ page }) => {
  await page.getByRole("button", { name: "Identità" }).first().click();
  await page.getByRole("button", { name: "Nuova identità" }).click();
  await page.getByRole("heading", { name: /identità/i, level: 2 }).waitFor();
  await shot(page, "identity-editor");
});

test("new folder editor", async ({ page }) => {
  await page.getByRole("button", { name: "Altre azioni di creazione" }).click();
  await page.getByRole("menuitem", { name: /Nuova cartella/ }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "folder-editor");
});

test("delete host confirmation", async ({ page }) => {
  await page.getByRole("button", { name: "Lista" }).click();
  await page.getByRole("button", { name: "Azioni api-07" }).click();
  await page.getByRole("menuitem", { name: "Elimina host" }).click();
  await page.getByRole("heading", { name: "Elimina host" }).waitFor();
  await shot(page, "delete-host");
});

async function openFromLauncher(page, name) {
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("option", { name }).click();
  await page.locator(".xterm").first().waitFor();
  // Let the scripted session reach its prompt.
  await page.waitForTimeout(700);
}

test("session tab with terminal", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.mouse.move(1275, 795);
  await shot(page, "session");
});

test("split workspace", async ({ page }) => {
  await openFromLauncher(page, /Produzione.*connessioni/);
  await page.mouse.move(1275, 795);
  await shot(page, "split");
});

test("several tabs and the new-tab launcher", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.getByRole("button", { name: "Nuova connessione" }).click();
  await page.getByRole("option", { name: /database-01/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Nuova connessione" }).click();
  await page.getByRole("combobox", { name: "Cerca host o schede" }).waitFor();
  await page.mouse.move(1275, 795);
  await shot(page, "tabs");
});

test("dragging the divider resizes split panes", async ({ page }) => {
  await openFromLauncher(page, /Produzione.*connessioni/);
  const divider = page.locator(".cursor-col-resize");
  await divider.waitFor();
  const first = page.locator(".xterm").first();
  const before = (await first.boundingBox()).width;
  const box = await divider.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + 200;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y, { steps: 6 });
  await page.mouse.up();
  const after = (await first.boundingBox()).width;
  expect(after).toBeGreaterThan(before + 100);
});

test("dragging a tab reorders the bar", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.getByRole("button", { name: "Nuova connessione" }).click();
  await page.getByRole("option", { name: /database-01/ }).click();
  await page.locator(".xterm").nth(1).waitFor();
  const nav = page.getByRole("navigation", { name: "Sessioni e connessioni" });
  const labels = () =>
    nav.locator("[draggable=true]").evaluateAll((els) =>
      els.map((el) => el.textContent.trim()),
    );
  expect(await labels()).toEqual(["api-01", "database-01"]);
  const [a, b] = await nav.locator("[draggable=true]").all();
  const target = await b.boundingBox();
  await a.dragTo(b, {
    targetPosition: { x: target.width - 8, y: target.height / 2 },
  });
  expect(await labels()).toEqual(["database-01", "api-01"]);
});

test("new key sheet", async ({ page }) => {
  await page.getByRole("button", { name: "Chiavi SSH" }).first().click();
  await page.getByRole("button", { name: "Importa chiave" }).click();
  await page.getByRole("heading", { name: /chiave/i, level: 2 }).waitFor();
  await shot(page, "key-editor");
});

test("editor beside the content at medium width", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: /host/i }).first().waitFor();
  await page.mouse.move(5, 695);
  await shot(page, "editor-medium");
});

test("empty identities page shows only the empty state", async ({ page }) => {
  await page.getByRole("button", { name: "Identità" }).first().click();
  await page.getByRole("textbox", { name: "Cerca" }).fill("zzzz-nessuna");
  await page.getByRole("heading", { name: "Nessun risultato" }).waitFor();
  await expect(page.locator("table")).toBeHidden();
  await page.mouse.move(1275, 795);
  await shot(page, "empty-identities");
});

test("password fields can be shown and hidden", async ({ page }) => {
  await page.getByRole("button", { name: "Identità" }).first().click();
  await page.getByRole("button", { name: "Nuova identità" }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Password" }).click();
  const input = page.locator('input[autocomplete="new-password"]');
  await input.fill("segreta");
  await expect(input).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostra password" }).click();
  await expect(input).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Nascondi password" }).click();
  await expect(input).toHaveAttribute("type", "password");
});
