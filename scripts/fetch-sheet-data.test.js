const assert = require("node:assert/strict");
const test = require("node:test");
const schema = require("./sheet-schema");
const { validateHeaders } = require("./fetch-sheet-data");

test("accepts header rows that exactly match the sheet schema", () => {
  const names = Object.keys(schema).filter(name => name !== "Inbox");
  const tabs = Object.fromEntries(names.map(name => [name, [schema[name]]]));

  assert.doesNotThrow(() => validateHeaders(tabs, names));
});

test("rejects missing, misspelled, reordered, and additional headers", () => {
  const invalidHeaders = [
    schema.Meta.slice(0, -1),
    ["key", "Value"],
    [...schema.Meta].reverse(),
    [...schema.Meta, "unexpected"]
  ];

  for (const headers of invalidHeaders) {
    assert.throws(
      () => validateHeaders({ Meta: [headers] }, ["Meta"]),
      /Header mismatch in Meta: expected \["key","value"\], received/
    );
  }
});

test("rejects a missing or empty sheet tab", () => {
  assert.throws(
    () => validateHeaders({}, ["Meta"]),
    /Header mismatch in Meta/
  );
});
