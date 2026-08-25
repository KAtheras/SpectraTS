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

console.log("✔ analytics client/project options preserve IDs and cascade by period and scope");
