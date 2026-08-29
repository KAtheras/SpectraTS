"use strict";

const assert = require("assert");
const {
  isClosed,
  matchesProjectStatus,
  monthRange,
  projectTargetRealization,
  realization,
} = require("../netlify/functions/_analyticsRealization");

assert.strictEqual(isClosed({ isActive: false }), false);
assert.strictEqual(isClosed({ isActive: false, lifecycleStatus: "closed_out" }), true);
assert.strictEqual(isClosed({ isActive: true, status: "active" }), false);
assert.strictEqual(matchesProjectStatus({ isActive: true }, "open"), true);
assert.strictEqual(matchesProjectStatus({ isActive: true }, "closed"), false);
assert.strictEqual(matchesProjectStatus({ isActive: false }, "closed"), false);
assert.strictEqual(matchesProjectStatus({ isActive: false, lifecycleStatus: "closed_out" }, "closed"), true);
assert.strictEqual(realization(75, 100), 75);
assert.strictEqual(realization(75, 0), null);
assert.deepStrictEqual(monthRange("2026-06-01", "2026-08-01"), ["2026-06-01", "2026-07-01", "2026-08-01"]);
const targetLookups = {
  clients: new Map([["c1", { id: "c1", officeId: "o1" }]]),
};
assert.strictEqual(
  projectTargetRealization({ clientId: "c1", projectDepartmentId: "d1", targetRealizationPct: 91 }, targetLookups, new Map()),
  91
);
assert.strictEqual(
  projectTargetRealization({ clientId: "c1", projectDepartmentId: "d1" }, targetLookups, new Map([["o1::d1", 84]])),
  84
);

console.log("✔ realization aggregates preserve cohorts and cumulative month ranges");
