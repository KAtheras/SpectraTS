"use strict";

const assert = require("assert");
const { _test } = require("../netlify/functions/records");

const row = {
  id: "00000000-0000-0000-0000-000000000123",
  date: "2026-08-25",
  createdAt: "2026-08-25T14:30:00.000Z",
};
const cursor = _test.encodeCursor(row, "date");
assert.deepStrictEqual(_test.decodeCursor(cursor), {
  id: row.id,
  date: row.date,
  createdAt: row.createdAt,
});

assert.strictEqual(_test.decodeCursor("not-a-cursor"), null);
assert.strictEqual(_test.parseRecordsQuery({ type: "entries", from: "", to: "2026-08-25" }), null);
assert.strictEqual(_test.parseRecordsQuery({ type: "entries", from: "2026-02-30", to: "2026-08-25" }), null);
assert.strictEqual(_test.parseRecordsQuery({ type: "entries", from: "2026-09-01", to: "2026-08-25" }), null);
assert.strictEqual(_test.parseRecordsQuery({ type: "unknown", from: "2026-01-01", to: "2026-08-25" }), null);
assert.strictEqual(_test.parseRecordsQuery({ type: "entries", from: "2026-01-01", to: "2026-08-25", limit: "999" }).limit, 250);
assert.strictEqual(_test.parseRecordsQuery({ type: "expenses", from: "2026-01-01", to: "2026-08-25", limit: "0" }).limit, 1);
assert.strictEqual(_test.parseRecordsQuery({ type: "entries", from: "2026-01-01", to: "2026-08-25", cursor }).cursor.id, row.id);

console.log("✔ records endpoint validates bounded queries and opaque cursors");
