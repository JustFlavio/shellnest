import { test } from "node:test";
import assert from "node:assert/strict";
import { stripWhitespace } from "./input-text.ts";

test("SSH fields remove typed and pasted whitespace", () => {
  for (const value of [
    " 192.0.2.10 ",
    "\t192.0.2.10\r\n",
    "\u00a0192.0.2.10\u202f",
    "192.0. 2.10",
  ]) {
    assert.equal(stripWhitespace(value), "192.0.2.10");
  }
  assert.equal(stripWhitespace(" deploy "), "deploy");
  assert.equal(stripWhitespace("de ploy\t"), "deploy");
  assert.equal(stripWhitespace(" \t\n"), "");
  for (const value of ["server.example.com", "2001:db8::1", "root", ""])
    assert.equal(stripWhitespace(value), value);
});
