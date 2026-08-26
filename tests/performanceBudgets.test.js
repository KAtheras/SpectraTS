"use strict";

const assert = require("assert");
const performanceBudgets = require("../performanceBudgets");

assert.deepStrictEqual(performanceBudgets.evaluate({ path: "/api/records", responseBytes: 1000, totalMs: 20 }).exceeded, []);
assert.deepStrictEqual(
  performanceBudgets.evaluate({ path: "/.netlify/functions/analytics", responseBytes: 300000, totalMs: 2500 }).exceeded.map((row) => row.metric),
  ["responseBytes", "totalMs"]
);
assert.strictEqual(performanceBudgets.endpointKey("/api/state"), "state");

console.log("✔ client performance budgets detect oversized or slow responses");
