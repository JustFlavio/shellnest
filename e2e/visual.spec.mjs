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

test("closing the editor returns focus to the button that opened it", async ({ page }) => {
  const button = page.getByRole("button", { name: "Nuovo host", exact: true });
  await button.click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

test("focus goes back to the pressed button even when the browser did not focus it", async ({
  page,
}) => {
  // WebKit leaves focus where it was on a button click: emulate that with synthetic events.
  await page.getByRole("button", { name: "Altre azioni di creazione" }).focus();
  const button = page.getByRole("button", { name: "Nuovo host", exact: true });
  await button.dispatchEvent("pointerdown");
  await button.dispatchEvent("click");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

test("a dragged pane makes room: the others close ranks, then return", async ({
  page,
}) => {
  await openFromLauncher(page, /Produzione.*connessioni/);
  const handles = page.locator('[title="Trascina per spostare il pannello"]');
  const second = page.locator(".xterm").nth(1);
  const before = (await second.boundingBox()).width;
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await handles.first().dispatchEvent("dragstart", { dataTransfer: dt });
  await expect
    .poll(async () => (await second.boundingBox()).width)
    .toBeGreaterThan(before + 100);
  await handles.first().dispatchEvent("dragend", { dataTransfer: dt });
  await expect
    .poll(async () => Math.abs((await second.boundingBox()).width - before))
    .toBeLessThan(2);
});

test("pane close button only shows on hover", async ({ page }) => {
  await openFromLauncher(page, /Produzione.*connessioni/);
  await page.mouse.move(1275, 795);
  const close = page.getByRole("button", { name: /Chiudi pannello/ }).first();
  await expect(close).toHaveCSS("opacity", "0");
  await page.locator(".xterm").first().hover();
  await expect(close).toHaveCSS("opacity", "1");
});

test("pane divider shows a grip on hover", async ({ page }) => {
  await openFromLauncher(page, /Produzione.*connessioni/);
  const divider = page.locator(".cursor-col-resize");
  const box = await divider.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("divider-hover.png", {
    clip: { x: box.x - 60, y: box.y + 200, width: 120 + box.width, height: 200 },
  });
});

const termText = (page) => page.locator(".xterm-rows").first().innerText();
const pasteInto = (page, text) =>
  page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    document.querySelector(".xterm-helper-textarea").dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);

test("paste strips control characters", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.locator(".xterm").first().click();
  await pasteInto(page, "echo a\x1b[201~b\x07c");
  await expect.poll(() => termText(page)).toContain("echo a[201~bc");
});

test("big paste asks for confirmation", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.locator(".xterm").first().click();
  const lines = Array.from({ length: 25 }, (_, i) => "riga" + i).join("\n");
  await pasteInto(page, lines);
  await page.getByRole("heading", { name: "Incollare più righe?" }).waitFor();
  expect(await termText(page)).not.toContain("riga3");
  await shot(page, "paste-confirm");
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByRole("heading", { name: "Incollare più righe?" })).toHaveCount(0);
  expect(await termText(page)).not.toContain("riga3");
  await pasteInto(page, lines);
  await page.getByRole("button", { name: "Incolla", exact: true }).click();
  await expect.poll(() => termText(page)).toContain("riga24");
});

test("Cmd+K clears screen and scrollback", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.locator(".xterm").first().click();
  await page.keyboard.type("echo ciao");
  await page.keyboard.press("Enter");
  await expect.poll(() => termText(page)).toContain("echo ciao");
  await page.keyboard.press("Meta+k");
  await expect.poll(() => termText(page)).not.toContain("echo ciao");
});

test("Cmd+C copies the selection, right click pastes", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromLauncher(page, /api-01/);
  const term = page.locator(".xterm").first();
  await term.click();
  await page.keyboard.type("echo ciao");
  await page.getByText("Sessione dimostrativa", { exact: false }).first().click({ clickCount: 3 });
  await page.keyboard.press("Meta+c");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Sessione dimostrativa");
  await page.evaluate(() => navigator.clipboard.writeText("incollato\x1b[31m"));
  await term.click({ button: "right", position: { x: 300, y: 300 } });
  await expect.poll(() => termText(page)).toContain("incollato[31m");
});

test("Cmd+click opens a terminal link, plain click does not", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.locator(".xterm").first().click();
  await page.keyboard.type("vai a https://example.com/prova ora");
  const row = page.locator(".xterm-rows > div", { hasText: "https://example.com" }).first();
  const box = await row.boundingBox();
  // the measure element holds 32 characters
  const cell = await page.evaluate(
    () => document.querySelector(".xterm-char-measure-element").getBoundingClientRect().width / 32,
  );
  const x = box.x + cell * ("root@api-01:~$ vai a ".length + 8);
  const y = box.y + box.height / 2;
  let opened = 0;
  page.on("popup", () => opened++);
  await page.mouse.move(x - 5, y);
  await page.mouse.move(x, y);
  await page.waitForTimeout(300);
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  expect(opened).toBe(0);
  const popup = page.waitForEvent("popup");
  await page.keyboard.down("Meta");
  await page.mouse.click(x, y);
  await page.keyboard.up("Meta");
  expect(await (await popup).url()).toContain("example.com/prova");
});

test("Cmd+F opens the terminal search, Esc closes it and refocuses", async ({ page }) => {
  await openFromLauncher(page, /api-01/);
  await page.locator(".xterm").first().click();
  await page.keyboard.press("Meta+f");
  const box = page.getByRole("textbox", { name: "Cerca nel terminale" });
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute("placeholder", "Cerca nel terminale");
  await box.fill("dimostrativa");
  await page.mouse.move(1275, 795);
  await shot(page, "terminal-search");
  await page.getByRole("button", { name: "Risultato successivo" }).click();
  await box.press("Shift+Enter");
  await box.fill("zzzz");
  await expect(box).toHaveAttribute("aria-invalid", "true");
  await box.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(page.locator(".xterm-helper-textarea").first()).toBeFocused();
});
