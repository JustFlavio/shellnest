import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../locales/en.json" with { type: "json" };
import it from "../locales/it.json" with { type: "json" };
import { i18n, resolveLanguage } from "./i18n.ts";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(
  value: unknown,
  path = "",
  out = new Map<string, string>(),
): Map<string, string> {
  if (typeof value === "string") out.set(path, value);
  else
    for (const [key, child] of Object.entries(value as object))
      flatten(child, path ? `${path}.${key}` : key, out);
  return out;
}

/** Plural forms differ per language, so they are compared by their base key. */
function placeholders(messages: Map<string, string>) {
  const byKey = new Map<string, Set<string>>();
  for (const [key, text] of messages) {
    const base = key.replace(PLURAL_SUFFIX, "");
    const names = byKey.get(base) ?? new Set<string>();
    for (const [, name] of text.matchAll(/\{\{\s*([\w.]+)/g)) names.add(name);
    byKey.set(base, names);
  }
  return byKey;
}

test("every locale has the keys and placeholders of English", () => {
  const source = placeholders(flatten(en));
  const other = placeholders(flatten(it));
  assert.deepEqual([...other.keys()].sort(), [...source.keys()].sort());
  for (const [key, names] of source)
    assert.deepEqual(
      [...(other.get(key) ?? [])].sort(),
      [...names].sort(),
      key,
    );
});

test("the system locale picks the first supported language", () => {
  assert.equal(resolveLanguage("system", ["fr-FR", "it-IT", "en-US"]), "it");
  assert.equal(resolveLanguage("system", ["en-GB"]), "en");
  assert.equal(resolveLanguage("system", ["fr-FR"]), "en");
  assert.equal(resolveLanguage("system", []), "en");
});

test("an explicit preference wins over the system locale", () => {
  assert.equal(resolveLanguage("it", ["en-US"]), "it");
  assert.equal(resolveLanguage("xx", ["it-IT"]), "en");
});

test("the active language selects the text", async () => {
  await i18n.changeLanguage("it");
  assert.equal(i18n.t("language.system"), "Sistema");
  await i18n.changeLanguage("en");
  assert.equal(i18n.t("language.system"), "System");
});
