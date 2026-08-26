"use strict";

const assert = require("assert");
const {
  buildBuckets,
  businessDays,
  capacityHours,
} = require("../netlify/functions/_analyticsUtilization");

assert.strictEqual(businessDays("2026-08-24", "2026-08-30"), 5);
assert.strictEqual(capacityHours("2026-08-24", "2026-08-28", [{ id: "a" }]), 40);
assert.strictEqual(capacityHours("2026-08-24", "2026-08-28", [{ id: "a", activeFrom: "2026-08-26" }]), 24);
assert.strictEqual(buildBuckets("this_week", "2026-08-24", "2026-08-30").length, 7);
assert.strictEqual(buildBuckets("this_month", "2026-08-01", "2026-08-31").length, 6);
assert.deepStrictEqual(
  buildBuckets("custom", "2026-07-15", "2026-09-02").map((row) => row.key),
  ["m::2026-07-01", "m::2026-08-01", "m::2026-09-01"]
);

console.log("✔ utilization aggregates use bounded buckets and lifecycle capacity");
