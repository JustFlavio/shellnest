import { test, expect } from "@playwright/test";

// Step details, honest status icons, the retry cap and the connection log, on the browser preview.
// The preview replays a connection: .password.test hosts have the key refused and take
// "password-giusta" (three wrong passwords end the attempt), .fail.test hosts end in an error.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: (text) => (window.__copied.push(text), Promise.resolve()) },
    });
  });
  await page.goto("/?empty");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("heading", { name: "Host", level: 1 }).waitFor();
});

const addHost = async (page, name, address) => {
  await page.getByRole("button", { name: "Nuovo host", exact: true }).click();
  await page.getByRole("heading", { name: "Nuovo host" }).waitFor();
  await page.getByPlaceholder("IP o nome host").fill(address);
  await page.getByPlaceholder("Nome dell’host").fill(name);
  await page.getByRole("combobox", { name: "Utente SSH" }).fill("root");
  await page.getByPlaceholder("Password", { exact: true }).fill("segreto");
  await page.getByRole("button", { name: "Chiudi pannello" }).click();
};
const open = async (page, name) => {
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Impronta verificata, connetti" }).click();
};
const steps = (page) =>
  page.getByRole("list", { name: "Avanzamento della connessione" }).getByRole("listitem");
const typeWrong = async (page) => {
  await page.getByLabel("Password", { exact: true }).fill("sbagliata");
  await page.keyboard.press("Enter");
};

test("saved host with a key: only the usual steps, with their outcome", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Esplora interfaccia" }).click();
  await page.getByRole("button", { name: "Connessione rapida" }).click();
  // The timeline is gone in a blink for a known host: record what it showed.
  await page.evaluate(() => {
    window.__seen = [];
    new MutationObserver(() => {
      const list = document.querySelector('[aria-label="Avanzamento della connessione"]');
      if (list) window.__seen.push([...list.children].map((li) => li.textContent));
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByRole("option", { name: /api-01/ }).click();
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
  const seen = await page.evaluate(() => window.__seen);
  expect(seen.length).toBeGreaterThan(0);
  for (const list of seen) expect(list.length).toBe(3);
  const text = seen.flat().join("|");
  expect(text).not.toContain("Password");
  expect(text).not.toContain("avviso");
  expect(text).toContain("Autenticato con la chiave “Deploy”");
  expect(text).toContain("Host già noto, impronta coincide");
  expect(text).not.toContain("SSH-2.0");
});

test("key refused, then the password: warning on the key, one Password step", async ({ page }) => {
  await addHost(page, "chiave", "chiave.password.test");
  await open(page, "chiave");
  await expect(steps(page)).toHaveText([
    /Connessione a/,
    /Verifica impronta/,
    /Autenticazione/,
    /Password/,
    /Sessione aperta/,
  ]);
  const auth = steps(page).nth(2);
  await expect(auth).toContainText("completato con avviso");
  await expect(auth).toContainText("Chiave rifiutata dal server");
  await expect(auth.locator("svg.lucide-triangle-alert")).toBeVisible();
  await expect(auth.locator("svg.lucide-check")).toHaveCount(0);
  await expect(steps(page).nth(1)).toContainText("Nuova impronta confermata");

  await page.getByLabel("Password", { exact: true }).fill("password-giusta");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Sessione dimostrativa")).toBeVisible();
});

test("a wrong password adds a step; three end the attempt with the log and Ricomincia", async ({ page }) => {
  await addHost(page, "chiave", "chiave.password.test");
  await open(page, "chiave");
  await typeWrong(page);
  await expect(steps(page)).toHaveCount(6);
  await expect(steps(page).nth(3)).toContainText("Password non accettata");
  await expect(steps(page).nth(4)).toContainText("Password (tentativo 2)");
  await typeWrong(page);
  await expect(steps(page).nth(5)).toContainText("Password (tentativo 3)");
  await typeWrong(page);

  const last = steps(page).nth(5);
  await expect(last).toContainText("non riuscito");
  await expect(last.getByRole("alert")).toHaveText("Password non accettata dopo 3 tentativi.");
  await expect(last.getByRole("alert")).toHaveCSS("color", "rgb(255, 107, 97)");
  // no fourth question
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ricomincia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chiudi", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mostra log" }).click();
  const log = page.getByLabel("Log della connessione");
  await expect(log).toContainText("Server remoto: SSH-2.0-OpenSSH_9.6");
  await expect(log).toContainText("Tentativo con password 3 di 3");
  await expect(log).toContainText("Errore: Password non accettata dopo 3 tentativi.");
  await expect(log).not.toContainText("sbagliata");

  await page.getByRole("button", { name: "Ricomincia" }).click();
  // the host is trusted now: no fingerprint step
  await expect(steps(page).nth(1)).toContainText("Autenticazione");
});

test("Chiudi on the failure closes the tab", async ({ page }) => {
  await addHost(page, "guasto", "guasto.fail.test");
  await open(page, "guasto");
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.getByRole("list", { name: "Avanzamento della connessione" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chiudi guasto" })).toHaveCount(0);
});

test("the log toggles, copies and stays out of storage", async ({ page }) => {
  await addHost(page, "guasto", "guasto.fail.test");
  await open(page, "guasto");
  await expect(steps(page).nth(2).getByRole("alert")).toHaveText("Autenticazione fallita");
  const log = page.getByLabel("Log della connessione");
  await expect(log).toHaveCount(0);
  await page.getByRole("button", { name: "Mostra log" }).click();
  await expect(log).toContainText("Impronta del server nota e coincidente");
  await page.getByRole("button", { name: "Nascondi log" }).click();
  await expect(log).toHaveCount(0);

  await page.getByRole("button", { name: "Mostra log" }).click();
  const copy = page.getByRole("button", { name: "Copia log" });
  await expect(copy.locator("svg.lucide-copy")).toBeVisible();
  await copy.click();
  await expect(copy.locator("svg.lucide-check")).toBeVisible();
  await expect(copy.locator("svg.lucide-copy")).toBeVisible({ timeout: 4000 });
  const copied = await page.evaluate(() => window.__copied.join("\n"));
  expect(copied).toContain("Risoluzione di guasto.fail.test:22");
  expect(copied).toContain("Errore: Autenticazione fallita");
  expect(copied).not.toContain("segreto");
  const stored = await page.evaluate(() =>
    JSON.stringify([localStorage, sessionStorage].map((s) => Object.entries(s))),
  );
  expect(stored).not.toContain("Risoluzione");
});
