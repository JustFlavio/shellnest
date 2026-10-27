import { test } from "node:test";
import assert from "node:assert/strict";
import {
  atBottom,
  formatOffset,
  logKind,
  logSegments,
  logText,
} from "./connection-log.ts";

test("kinds follow the wording of the Rust lines", () => {
  const kinds: [string, string][] = [
    ["Risoluzione di h.example:22", "network"],
    ["Indirizzi trovati: 192.0.2.10", "network"],
    ["Server remoto: SSH-2.0-OpenSSH_9.6", "network"],
    ["Connessione stabilita", "network"],
    ["Algoritmi negoziati: scambio chiavi curve25519-sha256", "tech"],
    ["Impronta del server nota e coincidente: SHA256:abc", "fingerprint"],
    ["Autenticazione con chiave per l’utente root", "auth"],
    ["Metodi ancora accettati dal server: password, publickey", "auth"],
    ["Tentativo con password 1 di 3", "auth"],
    ["Autenticazione con chiave rifiutata dal server", "error"],
    ["Password rifiutata dal server", "error"],
    ["Password non accettata dopo 3 tentativi.", "error"],
    ["Autenticazione annullata dall’utente", "error"],
    ["Impronta del server cambiata: attesa A, ricevuta B", "error"],
    ["Errore: Timeout connessione SSH", "error"],
    ["Password accettata", "success"],
    ["Autenticazione con chiave accettata", "success"],
  ];
  for (const [text, kind] of kinds) assert.equal(logKind(text), kind, text);
});

test("offsets in seconds, then in minutes", () => {
  assert.equal(formatOffset(0), "+0,0 s");
  assert.equal(formatOffset(340), "+0,3 s");
  assert.equal(formatOffset(12_340), "+12,3 s");
  assert.equal(formatOffset(125_000), "+2 min 05 s");
  assert.equal(formatOffset(-5), "+0,0 s");
});

test("the copied text is one plain line per event, with the offset", () => {
  assert.equal(
    logText([
      { text: "Risoluzione di h:22", at: 0 },
      { text: "<b>Errore: x</b>", at: 1500 },
    ]),
    "+0,0 s  Risoluzione di h:22\n+1,5 s  <b>Errore: x</b>",
  );
});

test("values are emphasised, technical lines and errors are not", () => {
  const joined = (text: string) =>
    logSegments(text, logKind(text))
      .map((s) => (s.strong ? `[${s.text}]` : s.text))
      .join("");
  assert.equal(
    joined("Risoluzione di h.example:22"),
    "Risoluzione di [h.example:22]",
  );
  assert.equal(
    joined("Server remoto: SSH-2.0-X"),
    "Server remoto: [SSH-2.0-X]",
  );
  assert.equal(
    joined("Autenticazione con password salvata per l’utente root"),
    "Autenticazione con [password salvata] per l’utente [root]",
  );
  assert.equal(
    joined("Algoritmi negoziati: a, b"),
    "Algoritmi negoziati: a, b",
  );
  assert.equal(joined("Errore: Impronta: x"), "Errore: Impronta: x");
  assert.equal(joined("Connessione stabilita"), "Connessione stabilita");
});

test("stays pinned only near the end", () => {
  assert.ok(atBottom(800, 200, 1000));
  assert.ok(atBottom(790, 200, 1000));
  assert.ok(!atBottom(500, 200, 1000));
});
