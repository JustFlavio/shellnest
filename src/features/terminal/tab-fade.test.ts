import test from "node:test";
import assert from "node:assert/strict";
import { fadeMask, hiddenEdges } from "./tab-fade.ts";

test("no hidden edge when everything fits", () => {
  assert.deepEqual(hiddenEdges(0, 300, 300), { left: false, right: false });
  assert.equal(fadeMask(hiddenEdges(0, 300, 300)), undefined);
});

test("hidden edges follow the scroll position", () => {
  assert.deepEqual(hiddenEdges(0, 900, 300), { left: false, right: true });
  assert.deepEqual(hiddenEdges(200, 900, 300), { left: true, right: true });
  assert.deepEqual(hiddenEdges(600, 900, 300), { left: true, right: false });
  assert.deepEqual(hiddenEdges(599.5, 900, 300), { left: true, right: false });
});

test("mask fades only the hidden sides", () => {
  assert.match(
    fadeMask({ left: false, right: true })!,
    /#000 0px.*transparent\)$/,
  );
  assert.match(
    fadeMask({ left: true, right: false })!,
    /^linear-gradient\(to right, transparent/,
  );
});
