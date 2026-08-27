"use strict";

const assert = require("assert");

global.window = {};
require("../accessControl.js");

const state = {
  users: [
    { id: "lead", role: "manager" },
    { id: "dual", role: "manager" },
    { id: "staff", role: "staff" },
    { id: "client-only", role: "manager" },
  ],
  projects: [
    { id: "project-1", client: "Client", name: "Project", projectLeadId: "lead" },
  ],
  assignments: {
    managerClients: [{ managerId: "client-only", client: "Client" }],
    managerProjects: [{ managerId: "dual", projectId: "project-1" }],
    projectMembers: [
      { userId: "dual", projectId: "project-1" },
      { userId: "staff", projectId: "project-1" },
    ],
  },
  levelLabels: {},
};

const access = window.accessControl.createAccessControl({
  state,
  normalizeLevel: (value) => Number(value) || 1,
  projectKey: (client, project) => `${client}::${project}`,
  uniqueValues: (values) => [...new Set(values.filter(Boolean))],
  catalogProjectNames: () => [],
});

const team = access.projectTeamAssignments("Client", "Project");
const byId = new Map(team.map((item) => [item.userId, item]));

assert.deepStrictEqual([...byId.keys()], ["lead", "dual", "staff"]);
assert.strictEqual(byId.get("lead").isProjectLead, true);
assert.strictEqual(byId.get("lead").removeAction, null);
assert.strictEqual(byId.get("dual").isDirectProjectManager, true);
assert.strictEqual(byId.get("dual").isProjectMember, true);
assert.strictEqual(byId.get("dual").removeAction, "both");
assert.strictEqual(byId.get("staff").displayGroup, "staff");
assert.strictEqual(byId.has("client-only"), false);

state.levelLabels = {
  1: { label: "CEO", permissionGroup: "superuser" },
  2: { label: "Office Managing Partner", permissionGroup: "admin" },
  5: { label: "Manager", permissionGroup: "manager" },
  8: { label: "Admin Assistant", permissionGroup: "staff" },
};
assert.strictEqual(
  access.permissionGroupForUser({ level: 2, role: "staff" }),
  "admin",
  "configured level mapping must override a stale legacy role"
);
assert.strictEqual(access.levelLabel(5), "Manager");
assert.strictEqual(
  access.permissionGroupForUser({ role: "staff" }),
  "staff",
  "a missing level must not inherit the Level 1 permission group"
);

console.log("✔ canonical project team preserves assignment sources");
