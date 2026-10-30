import { test } from "node:test";
import assert from "node:assert/strict";
import { newHost } from "../../lib/types.ts";
import { stripWhitespace } from "../../lib/input-text.ts";
import { hostDraftIsValid } from "./host-draft.ts";

test("pasted address whitespace blocks Connect until removed by the input", () => {
  const draft = {
    ...newHost(),
    name: "Production server",
    address: "192.0.2.10 ",
    credentials: {
      username: "deploy",
      password: " secret ",
    },
  };
  assert.equal(hostDraftIsValid(draft, []), false);
  const cleaned = { ...draft, address: stripWhitespace(draft.address) };
  assert.equal(hostDraftIsValid(cleaned, []), true);
  assert.equal(cleaned.name, "Production server");
  assert.equal(cleaned.credentials.password, " secret ");
});

test("input cleanup does not bypass endpoint or credential validation", () => {
  const draft = {
    ...newHost(),
    name: "Host",
    address: stripWhitespace(" \t "),
    credentials: { username: "root", password: "secret" },
  };
  assert.equal(hostDraftIsValid(draft, []), false);
  assert.equal(hostDraftIsValid({ ...draft, address: "user@host" }, []), false);
  assert.equal(
    hostDraftIsValid({ ...draft, address: "host", ownPort: 0 }, []),
    false,
  );
  assert.equal(
    hostDraftIsValid(
      {
        ...draft,
        address: "host",
        credentials: { username: stripWhitespace(" \t "), password: "secret" },
      },
      [],
    ),
    false,
  );
  assert.equal(
    hostDraftIsValid(
      {
        ...draft,
        address: "host",
        credentials: { username: "root", password: "" },
      },
      [],
    ),
    false,
  );
});
