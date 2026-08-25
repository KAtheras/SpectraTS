"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBrowserScript(fileName) {
  const window = {};
  const source = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
  vm.runInNewContext(source, { window, console });
  return window;
}

const utilsWindow = loadBrowserScript("utils.js");
const normalizedProjects = utilsWindow.utils.normalizeProjects([
  { id: "p1", clientId: "c1", client: "Alpha", name: "Advisory" },
]);
assert.strictEqual(normalizedProjects[0].clientId, "c1");
assert.strictEqual(normalizedProjects[0].client_id, "c1");

const engineWindow = loadBrowserScript("analyticsEngine.js");
const options = engineWindow.analyticsEngine.listClientProjectOptions({
  clients: [
    { id: "c1", name: "Alpha", officeId: "o1" },
    { id: "c2", name: "Beta", officeId: "o2" },
  ],
  projects: [
    { id: "p1", clientId: "c1", client: "Alpha", name: "Advisory", officeId: "o1" },
    { id: "p2", clientId: "c2", client: "Beta", name: "Tax", officeId: "o2" },
  ],
  entries: [
    { projectId: "p1", date: "2026-08-10", userId: "u1" },
    { projectId: "p2", date: "2026-08-11", userId: "u2" },
  ],
  expenses: [],
  users: [
    { id: "u1", officeId: "o1" },
    { id: "u2", officeId: "o2" },
  ],
  offices: [
    { id: "o1", name: "New York" },
    { id: "o2", name: "Boston" },
  ],
  departments: [],
  filters: {
    fromDate: "2026-08-01",
    toDate: "2026-08-31",
    scope: "office",
    scopeId: "o1",
  },
});

assert.deepStrictEqual(Array.from(options.clients, (item) => item.id), ["c1"]);
assert.deepStrictEqual(Array.from(options.projects, (item) => item.id), ["p1"]);
assert.deepStrictEqual(Array.from(options.projectsByClient.get("c1"), (item) => item.id), ["p1"]);
assert.strictEqual(options.projectsByClient.has("c2"), false);

const memberScopedOptions = engineWindow.analyticsEngine.listClientProjectOptions({
  clients: [{ id: "c1", name: "Alpha" }, { id: "c2", name: "Beta" }],
  projects: [
    { id: "p1", clientId: "c1", name: "Advisory" },
    { id: "p2", clientId: "c2", name: "Tax" },
  ],
  entries: [
    { projectId: "p1", date: "2026-08-10", userId: "u1" },
    { projectId: "p2", date: "2026-08-11", userId: "u2" },
  ],
  users: [
    { id: "u1", displayName: "Alex", title: "Manager" },
    { id: "u2", displayName: "Blair", title: "Staff" },
  ],
  filters: { fromDate: "2026-08-01", toDate: "2026-08-31", scope: "member", scopeId: "u1" },
});
assert.deepStrictEqual(Array.from(memberScopedOptions.projects, (item) => item.id), ["p1"]);

const titleScopedOptions = engineWindow.analyticsEngine.listClientProjectOptions({
  clients: [{ id: "c1", name: "Alpha" }, { id: "c2", name: "Beta" }],
  projects: [
    { id: "p1", clientId: "c1", name: "Advisory" },
    { id: "p2", clientId: "c2", name: "Tax" },
  ],
  entries: [
    { projectId: "p1", date: "2026-08-10", userId: "u1" },
    { projectId: "p2", date: "2026-08-11", userId: "u2" },
  ],
  users: [{ id: "u1", title: "Manager" }, { id: "u2", title: "Staff" }],
  filters: { fromDate: "2026-08-01", toDate: "2026-08-31", scope: "title", scopeId: "Staff" },
});
assert.deepStrictEqual(Array.from(titleScopedOptions.projects, (item) => item.id), ["p2"]);

console.log("✔ analytics client/project options preserve IDs and cascade by period and scope");

const realization = engineWindow.analyticsEngine.computeRealizationAnalytics({
  clients: [{ id: "c1", name: "Alpha" }],
  projects: [{
    id: "p1",
    clientId: "c1",
    client: "Alpha",
    name: "Fixed Project",
    isActive: false,
    pricingModel: "fixed_fee",
    contractAmount: 1500,
  }],
  users: [{ id: "u1", baseRate: 100 }],
  entries: [
    { projectId: "p1", userId: "u1", date: "2026-06-10", hours: 10 },
    { projectId: "p1", userId: "u1", date: "2026-08-10", hours: 10 },
  ],
  expenses: [],
  filters: {
    fromDate: "2026-08-01",
    toDate: "2026-08-31",
    groupBy: "project",
  },
});

assert.strictEqual(realization.kpis.actualRevenue, 1500);
assert.strictEqual(realization.kpis.standardRevenue, 2000);
assert.strictEqual(realization.kpis.variance, -500);
assert.strictEqual(realization.kpis.projectCount, 1);
assert.strictEqual(realization.kpis.avgRealizationPct, 75);
const realizationRowKey = realization.rows[0].key;
assert.deepStrictEqual(
  Array.from(realization.monthlyByKey[realizationRowKey], (row) => row.standardRevenue),
  [1000, 1000, 2000]
);

const excludedRealization = engineWindow.analyticsEngine.computeRealizationAnalytics({
  clients: [{ id: "c1", name: "Alpha" }],
  projects: [{ id: "p1", clientId: "c1", name: "Fixed Project", isActive: false, contractAmount: 1500 }],
  users: [{ id: "u1", baseRate: 100 }],
  entries: [{ projectId: "p1", userId: "u1", date: "2026-07-31", hours: 10 }],
  expenses: [],
  filters: { fromDate: "2026-08-01", toDate: "2026-08-31", groupBy: "project" },
});
assert.strictEqual(excludedRealization.kpis.projectCount, 0);
assert.strictEqual(excludedRealization.rows.length, 0);

console.log("✔ realization uses completion-period cohorts with lifetime project economics");

const openForecast = engineWindow.analyticsEngine.computeRealizationAnalytics({
  clients: [{ id: "c1", name: "Alpha" }],
  projects: [{
    id: "p-open",
    clientId: "c1",
    client: "Alpha",
    name: "Open Project",
    isActive: true,
    pricingModel: "fixed_fee",
    contractAmount: 1000,
    planningStatus: "approved",
  }],
  users: [{ id: "u1", baseRate: 100 }],
  entries: [{ projectId: "p-open", userId: "u1", date: "2026-08-10", hours: 5 }],
  expenses: [],
  projectMemberBudgets: [{ projectId: "p-open", userId: "u1", budgetHours: 10 }],
  filters: {
    fromDate: "2026-01-01",
    toDate: "2026-12-31",
    groupBy: "project",
    statusMode: "open",
  },
});
assert.strictEqual(openForecast.kpis.actualRevenue, 1000);
assert.strictEqual(openForecast.kpis.standardRevenue, 1000);
assert.strictEqual(openForecast.kpis.avgRealizationPct, 100);
assert.strictEqual(openForecast.kpis.projectCount, 1);
assert.strictEqual(openForecast.kpis.limitedForecastCount, 0);

console.log("✔ open realization forecasts completion economics from project plans");
