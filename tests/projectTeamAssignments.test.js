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

console.log("✔ canonical project team preserves assignment sources");
