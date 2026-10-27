import { test, expect } from "@playwright/test";

// Quick connection from a bare address: the questions are steps of the timeline.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
  await page.getByRole("button", { name: "Connessione rapida" }).click();
});

const search = (page) => page.getByRole("combobox", { name: "Cerca host o schede" });
const steps = (page) =>
  page.getByRole("list", { name: "Avanzamento della connessione" }).locator("> li");
const start = async (page, text) => {
  await search(page).fill(text);
  await search(page).press("Meta+Enter");
  await page.getByLabel("Utente", { exact: true }).waitFor();
};
const approve = (page) =>
  page.getByRole("button", { name: "Impronta verificata, connetti" }).click();
const savedHost = (page, name) => page.getByRole("button", { name: "Seleziona " + name });
const goVault = async (page) => {
  await page.getByRole("navigation", { name: "Sessioni e connessioni" }).getByRole("button", { name: "Vault", exact: true }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
};

test("the target row and Cmd+Enter only start the timeline; the user comes from user@host", async ({ page }) => {
  await search(page).fill("root@192.0.2.50");
  await page.getByRole("option", { name: /root@192\.0\.2\.50:22/ }).click();
  await expect(page.getByLabel("Utente", { exact: true })).toHaveValue("root");
  await expect(steps(page)).toHaveText([
    /Utente/,
    /Metodo di accesso/,
    /Connessione a 192\.0\.2\.50:22/,
    /Verifica impronta/,
    /Autenticazione/,
    /Sessione aperta/,
  ]);
  await expect(steps(page).first()).toHaveAttribute("aria-current", "step");
});

test("Continua: user, password, fingerprint, session; nothing is saved", async ({ page }) => {
  await start(page, "192.0.2.50");
  await page.getByLabel("Utente", { exact: true }).fill("ubuntu");
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(steps(page).first()).toContainText("ubuntu");
  await expect(steps(page).nth(1)).toHaveAttribute("aria-current", "step");
  await page.getByRole("textbox", { name: /^Password/ }).fill("segreto");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(page.getByText("SHA256:impronta-dimostrativa")).toBeVisible();
  await expect(steps(page).nth(3)).toHaveAttribute("aria-current", "step");
  await approve(page);
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
  await goVault(page);
  await expect(savedHost(page, "192.0.2.50")).toHaveCount(0);
  const stored = await page.evaluate(() =>
    JSON.stringify([localStorage, sessionStorage].map((s) => Object.entries(s))),
  );
  expect(stored).not.toContain("segreto");
});

test("Continua e salva with a password creates a host named after the address", async ({ page }) => {
  await start(page, "192.0.2.51");
  await page.getByLabel("Utente", { exact: true }).fill("ubuntu");
  await page.getByRole("button", { name: "Avanti" }).click();
  const save = page.getByRole("button", { name: "Continua e salva" });
  await expect(save).toBeDisabled();
  await page.getByRole("textbox", { name: /^Password/ }).fill("segreto");
  await expect(page.getByLabel("Nome per “Continua e salva”")).toHaveValue("192.0.2.51");
  await page.getByLabel("Nome per “Continua e salva”").fill("nuovo-server");
  await save.click();
  await approve(page);
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
  await goVault(page);
  await expect(savedHost(page, "nuovo-server")).toBeVisible();
});

test("a saved identity answers both questions", async ({ page }) => {
  await start(page, "192.0.2.52");
  await page.getByLabel("Cerca identità").fill("deploy");
  await expect(page.getByRole("button", { name: /Deploy/ })).toHaveCount(1);
  await page.getByRole("button", { name: /Deploy/ }).click();
  await expect(page.getByLabel("Utente", { exact: true })).toHaveValue("deploy");
  await expect(page.getByLabel("Utente", { exact: true })).toBeDisabled();
  await expect(steps(page)).not.toContainText(["Metodo di accesso"]);
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await approve(page);
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
});

test("a key from the vault, saved as a host with a new identity", async ({ page }) => {
  await start(page, "192.0.2.53");
  await page.getByLabel("Utente", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Chiave", { exact: true }).check();
  await page.getByRole("combobox", { name: "Chiave dal portachiavi" }).click();
  await page.getByRole("option", { name: "Personale" }).click();
  await page.getByRole("button", { name: "Continua e salva" }).click();
  await approve(page);
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
  await goVault(page);
  await expect(savedHost(page, "192.0.2.53")).toBeVisible();
});

test("Ricomincia on a failed quick connection asks the questions again", async ({ page }) => {
  await start(page, "x.fail.test");
  await page.getByLabel("Utente", { exact: true }).fill("root");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await approve(page);
  await page.getByRole("button", { name: "Ricomincia" }).waitFor();
  await page.getByRole("button", { name: "Ricomincia" }).click();
  await expect(page.getByLabel("Utente", { exact: true })).toHaveValue("root");
});

test("Esc on the questions closes the tab", async ({ page }) => {
  await start(page, "192.0.2.54");
  await expect(page.getByLabel("Utente", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Utente", { exact: true })).toHaveCount(0);
});
