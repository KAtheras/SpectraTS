"use strict";

const assert = require("assert");
const { TARGET_ACCOUNT_ID, TARGET_ACCOUNT_NAME, buildScenarioData, deterministicUuid, parseArgs } =
  require("../scripts/seed-acme-analytics");

const offices = ["o1", "o2", "o3"].map((id, index) => ({ id, name: `Office ${index + 1}` }));
const departments = ["d1", "d2", "d3"].map((id, index) => ({ id, name: ["Audit", "Tax", "Consulting"][index] }));
const projects = Array.from({ length: 9 }, (_, index) => ({ id: String(index + 1), name: `Project ${index + 1}`,
  clientId: `c${index % 3}`, clientName: `Client ${index % 3}`, officeId: offices[index % 3].id,
  departmentId: departments[index % 3].id }));
const users = Array.from({ length: 9 }, (_, index) => ({ id: `u${index + 1}`, name: `Member ${index + 1}`,
  level: index % 7 + 1, officeId: offices[index % 3].id, departmentId: departments[index % 3].id,
  baseRate: 100 + index * 20, costRate: 50 + index * 5 }));
const tenant = { account: { id: TARGET_ACCOUNT_ID, name: TARGET_ACCOUNT_NAME }, offices, departments, projects, users,
  internalCategories: [{ id: "pto", name: "Approved Time Off", groupName: "PTO" },
    { id: "training", name: "Training", groupName: "Professional Development" }],
  expenseCategories: [{ id: "travel", name: "Travel" }] };
const options = { asOf: "2026-08-25", seed: "unit-seed" };
const first = buildScenarioData(tenant, options);
const second = buildScenarioData(tenant, options);

assert.strictEqual(first.fromDate, "2025-08-26");
assert.strictEqual(first.projectMembers.length, users.length * projects.length);
assert.strictEqual(new Set(first.entries.map((row) => row.id)).size, first.entries.length);
assert.strictEqual(new Set(first.expenses.map((row) => row.id)).size, first.expenses.length);
assert.ok(first.entries.every((row) => row.hours > 0 && row.hours <= 14));
assert.ok(first.entries.length < 4000);
assert.deepStrictEqual(first, second);
users.forEach((user) => projects.forEach((project) => {
  assert.ok(first.entries.some((row) => row.user_id === user.id && row.project_id === Number(project.id)));
}));
assert.ok(first.projectUpdates.some((row) => row.is_active === false));
assert.ok(first.projectUpdates.some((row) => row.pricing_model === "time_and_materials"));
assert.ok(first.projectUpdates.some((row) => row.scenario_key === "open_limited"));
assert.strictEqual(deterministicUuid("unit-seed", "same"), deterministicUuid("unit-seed", "same"));
assert.throws(() => parseArgs(["--apply"]), /confirm-account-id/);
assert.strictEqual(parseArgs(["--apply", `--confirm-account-id=${TARGET_ACCOUNT_ID}`]).apply, true);

console.log("✔ ACME analytics seed is deterministic, tenant-locked, and covers every member/project pair");
