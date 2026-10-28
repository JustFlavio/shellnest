import test from "node:test";
import assert from "node:assert/strict";
import { isBusy, percentOf, statusLine, updateFailure } from "./update-flow.ts";
import { i18n } from "../../i18n/i18n.ts";

// These assertions read the Italian copy.
await i18n.changeLanguage("it");

test("percent is whole, clamped, and null without a total", () => {
  assert.equal(percentOf(0, 1000), 0);
  assert.equal(percentOf(999, 1000), 99);
  assert.equal(percentOf(1500, 1000), 100);
  assert.equal(percentOf(10, undefined), null);
  assert.equal(percentOf(10, 0), null);
});

test("known failures read in Italian, unknown ones keep their text", () => {
  assert.match(
    updateFailure("signature verification failed"),
    /chiave di firma/,
  );
  assert.match(
    updateFailure(new Error("error sending request for url")),
    /non raggiungibile/,
  );
  assert.match(
    updateFailure("Could not fetch a valid release JSON from the remote"),
    /nessun elenco/,
  );
  assert.equal(updateFailure(new Error("Error: boom")), "boom");
  assert.equal(updateFailure(""), "errore sconosciuto");
});

test("only checking, downloading and installing are busy", () => {
  assert.equal(isBusy({ kind: "checking" }), true);
  assert.equal(isBusy({ kind: "downloading", version: "1", percent: 3 }), true);
  assert.equal(isBusy({ kind: "installing", version: "1" }), true);
  assert.equal(isBusy({ kind: "ready", version: "1" }), false);
  assert.equal(isBusy({ kind: "error", message: "x" }), false);
});

test("the status line names the version and the progress", () => {
  assert.match(statusLine({ kind: "available", version: "0.2.0" }), /0\.2\.0/);
  assert.match(
    statusLine({ kind: "downloading", version: "0.2.0", percent: 40 }),
    /40%/,
  );
  assert.match(
    statusLine({ kind: "error", message: "rete" }),
    /Controllo non riuscito: rete/,
  );
});
