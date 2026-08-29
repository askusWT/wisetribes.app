const assert = require("node:assert/strict");
const test = require("node:test");
const schema = require("./sheet-schema");
const { hasSheetCredentials, mayUseSampleData, validateHeaders } = require("./fetch-sheet-data");

test("uses sample data for Vercel previews without weakening production builds", () => {
  assert.equal(mayUseSampleData({ VERCEL_ENV: "preview" }), true);
  assert.equal(mayUseSampleData({ VERCEL_ENV: "development" }), true);
  assert.equal(mayUseSampleData({ VERCEL_ENV: "production" }), false);
  assert.equal(mayUseSampleData({}), false);
  assert.equal(mayUseSampleData({ ALLOW_SAMPLE_DATA: "true" }), true);
});

test("requires both Google Sheets credentials", () => {
  assert.equal(hasSheetCredentials({ GOOGLE_SHEET_ID: "sheet", GOOGLE_SERVICE_ACCOUNT_JSON: "{}" }), true);
  assert.equal(hasSheetCredentials({ GOOGLE_SHEET_ID: "sheet" }), false);
  assert.equal(hasSheetCredentials({ GOOGLE_SERVICE_ACCOUNT_JSON: "{}" }), false);
});

test("accepts header rows that exactly match the sheet schema", () => {
  const names = Object.keys(schema).filter(name => name !== "Inbox");
  const tabs = Object.fromEntries(names.map(name => [name, [schema[name]]]));

  assert.doesNotThrow(() => validateHeaders(tabs, names));
});

test("accepts header rows with whitespace normalized by the record parser", () => {
  assert.doesNotThrow(() => validateHeaders({ Meta: [[" key ", "value\t"]] }, ["Meta"]));
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

test("rejects tab names that are not in the schema with a descriptive error", () => {
  assert.throws(
    () => validateHeaders({ Unknown: [["key", "value"]] }, ["Unknown"]),
    /Unknown tab in schema: Unknown\. Available tabs: Meta, Ladder/
  );
});
