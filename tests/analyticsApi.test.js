"use strict";

const assert = require("assert");
const { _test } = require("../netlify/functions/analytics");

assert.strictEqual(_test.isIsoDate("2026-08-25"), true);
assert.strictEqual(_test.isIsoDate("2026-02-30"), false);
assert.strictEqual(_test.parseQuery({ report: "profitability", from: "", to: "2026-08-25" }), null);
assert.strictEqual(_test.parseQuery({ report: "utilization", from: "2026-01-01", to: "2026-08-25" }).groupBy, "member");
assert.deepStrictEqual(
  _test.parseQuery({
    report: "profitability",
    from: "2026-01-01",
    to: "2026-08-25",
    scope: "office",
    scopeId: "ny",
    clientId: "12",
    projectId: "34",
  }),
  {
    report: "profitability",
    from: "2026-01-01",
    to: "2026-08-25",
    scope: "office",
    scopeId: "ny",
    clientId: "12",
    projectId: "34",
    period: "custom",
    groupBy: "member",
    officeId: "",
    departmentId: "",
    memberId: "",
    memberTitle: "",
    statusMode: "open",
  }
);
assert.strictEqual(_test.parseQuery({ report: "realization", from: "2026-01-01", to: "2026-08-25", statusMode: "closed" }).statusMode, "closed");
for (const groupBy of ["client", "project", "office", "department"]) {
  assert.strictEqual(
    _test.parseQuery({ report: "realization", from: "2026-01-01", to: "2026-08-25", groupBy }).groupBy,
    groupBy,
    `realization should preserve ${groupBy} grouping`
  );
}
assert.strictEqual(
  _test.parseQuery({ report: "realization", from: "2026-01-01", to: "2026-08-25", groupBy: "member" }).groupBy,
  "client"
);

console.log("✔ analytics API validates report filters and date bounds");
