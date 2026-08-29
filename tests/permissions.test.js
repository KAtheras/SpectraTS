"use strict";

const assert = require("assert");
const path = require("path");
const perms = require("../netlify/functions/permissions");
const db = require("../netlify/functions/_db");
const fs = require("fs");

const workbookPath = path.join(__dirname, "..", "final_permission_spec_clean.xlsx");
const records = perms.parseWorkbook(workbookPath);
const structs = perms.buildStructures(records);
const index = perms.buildIndex(structs);

function ctx(extra) {
  return { permissionIndex: index, ...extra };
}

function hasPerm(role, capability, scope) {
  return structs.permissions.some(
    (p) => p.role_key === role && p.capability_key === capability && p.scope_key === scope && p.allowed
  );
}

function indexFromRows(rows) {
  return perms.buildIndex({ permissions: rows });
}

test("database permission resolution requires the configured numeric level mapping", () => {
  const levelLabels = { 3: { label: "Partner", permissionGroup: "executive" } };
  assert.strictEqual(
    db.permissionGroupForUser({ id: "partner", level: 3, role: "stale" }, levelLabels),
    "executive"
  );
  assert.throws(
    () => db.permissionGroupForUser({ id: "unmapped", level: 6, role: "superuser" }, levelLabels),
    /Missing permission group/
  );
});

// Users used in tests
const users = {
  superuser: { id: "su", permissionGroup: "superuser", office_id: "A" },
  adminA: { id: "admA", permissionGroup: "admin", office_id: "A" },
  execA: { id: "execA", permissionGroup: "executive", office_id: "A" },
  managerA: { id: "mgrA", permissionGroup: "manager", office_id: "A" },
  staffA: { id: "stfA", permissionGroup: "staff", office_id: "A" },
  adminB: { id: "admB", permissionGroup: "admin", office_id: "B" },
};

function test(name, fn) {
  try {
    fn();
    console.log(`✔ ${name}`);
  } catch (error) {
    console.error(`✖ ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

test("superuser has global settings access", () => {
  const allowed = perms.can(users.superuser, "view_member_rates", ctx({ resourceOfficeId: "Z" }));
  assert.strictEqual(allowed, true);
});

test("permissions table includes member visibility/rates rows", () => {
  assert.strictEqual(hasPerm("superuser", "view_members", "all_offices"), true);
  assert.strictEqual(hasPerm("superuser", "view_member_rates", "all_offices"), true);
  assert.strictEqual(hasPerm("admin", "view_members", "own_office"), true);
  assert.strictEqual(hasPerm("admin", "view_member_rates", "own_office"), true);
  assert.strictEqual(hasPerm("executive", "view_members", "own_office"), true);
  assert.strictEqual(hasPerm("manager", "view_members", "own_office"), true);
});

test("can() works with DB-loaded rows for member visibility/rates", () => {
  const dbIndex = indexFromRows(structs.permissions);
  const canDb = (user, cap, extra) => perms.can(user, cap, { permissionIndex: dbIndex, ...extra });
  assert.strictEqual(canDb(users.superuser, "view_members", {}), true);
  assert.strictEqual(canDb(users.superuser, "view_member_rates", {}), true);
});

test("admin rates only in own office", () => {
  const sameOffice = perms.can(users.adminA, "edit_member_rates", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  const otherOffice = perms.can(users.adminA, "edit_member_rates", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(sameOffice, true);
  assert.strictEqual(otherOffice, false);
});

test("executive project ops limited to assigned projects", () => {
  const granted = perms.can(
    users.execA,
    "approve_time",
    ctx({ projectId: "p1", actorProjectIds: ["p1"], targetRoleKey: "manager", recordStatus: "pending" })
  );
  const denied = perms.can(
    users.execA,
    "approve_time",
    ctx({ projectId: "p2", actorProjectIds: ["p1"], targetRoleKey: "manager", recordStatus: "pending" })
  );
  assert.strictEqual(granted, true);
  assert.strictEqual(denied, false);
});

test("manager cannot approve executive time", () => {
  const allowed = perms.can(
    users.managerA,
    "approve_time",
    ctx({ projectId: "p1", actorProjectIds: ["p1"], targetRoleKey: "executive", recordStatus: "pending" })
  );
  assert.strictEqual(allowed, false);
});

test("executive can self-approve", () => {
  const allowed = perms.can(
    users.execA,
    "approve_time",
    ctx({ projectId: "p1", actorProjectIds: ["p1"], targetRoleKey: "executive", actorUserId: "execA", targetUserId: "execA", recordStatus: "pending" })
  );
  assert.strictEqual(allowed, true);
});

test("staff cannot view members", () => {
  const allowed = perms.can(users.staffA, "view_members", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("superuser can view members in any office", () => {
  const allowed = perms.can(users.superuser, "view_members", ctx({ resourceOfficeId: "Z" }));
  assert.strictEqual(allowed, true);
});

test("superuser can view member rates in any office", () => {
  const allowed = perms.can(users.superuser, "view_member_rates", ctx({ resourceOfficeId: "Z" }));
  assert.strictEqual(allowed, true);
});

test("admin can view members only in own office", () => {
  const allowedOwn = perms.can(users.adminA, "view_members", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  const deniedOther = perms.can(users.adminA, "view_members", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowedOwn, true);
  assert.strictEqual(deniedOther, false);
});

test("executive can view members only in own office", () => {
  const allowedOwn = perms.can(users.execA, "view_members", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  const deniedOther = perms.can(users.execA, "view_members", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowedOwn, true);
  assert.strictEqual(deniedOther, false);
});

test("manager can view members only in own office", () => {
  const allowedOwn = perms.can(users.managerA, "view_members", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  const deniedOther = perms.can(users.managerA, "view_members", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowedOwn, true);
  assert.strictEqual(deniedOther, false);
});

test("own_office checks fail when actor officeId is null", () => {
  const actorNullOffice = { ...users.managerA, office_id: null, officeId: null };
  const allowed = perms.can(actorNullOffice, "view_members", ctx({ resourceOfficeId: "A", actorOfficeId: null }));
  assert.strictEqual(allowed, false);
});

test("listUsers returns officeId when DB is available", async () => {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.log("Skipping DB-dependent listUsers test; NETLIFY_DATABASE_URL not set.");
    return;
  }
  const sql = await db.getSql();
  await db.ensureSchema(sql);
  const accountId = await db.ensureDefaultAccount(sql);
  const rows = await db.listUsers(sql, accountId);
  assert.ok(Array.isArray(rows));
  rows.forEach((u) => {
    assert.ok("officeId" in u);
  });
});

test("admin can view member rates only in own office", () => {
  const allowedOwn = perms.can(users.adminA, "view_member_rates", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  const deniedOther = perms.can(users.adminA, "view_member_rates", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowedOwn, true);
  assert.strictEqual(deniedOther, false);
});

test("staff cannot view settings shell", () => {
  const allowed = perms.can(users.staffA, "view_settings_shell", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("settings autosave handlers use the matching granular capabilities", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const adminSource = fs.readFileSync(path.join(__dirname, "..", "settingsAdmin.js"), "utf8");
  const mutationSource = fs.readFileSync(
    path.join(__dirname, "..", "netlify", "functions", "mutate.js"),
    "utf8"
  );
  assert.match(appSource, /departmentsForm[\s\S]*?permissions\?\.manage_departments/);
  assert.match(appSource, /targetRealizationsForm[\s\S]*?permissions\?\.manage_target_realizations/);
  assert.match(adminSource, /permissions\?\.can_delegate[\s\S]*?settingsAutosave\?\.begin\("delegations-form"\)/);
  assert.match(adminSource, /schedulePermissionsSave[\s\S]*?permissions\?\.manage_settings_access/);
  assert.match(
    mutationSource,
    /case "update_departments":[\s\S]*?can\("manage_departments"\)[\s\S]*?updateDepartments/
  );
});

test("department settings are persisted by one database transaction", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const mutationSource = fs.readFileSync(
    path.join(__dirname, "..", "netlify", "functions", "mutate.js"),
    "utf8"
  );
  assert.match(appSource, /mutatePersistentState\(\s*"update_departments"/);
  assert.match(
    appSource,
    /latestSaveState[\s\S]*?Number\(latestSaveState\.revision\) === savingRevision[\s\S]*?if \(responseIsCurrent\)/
  );
  assert.match(
    appSource,
    /rows\.forEach\(\(row, index\)[\s\S]*?row\.dataset\.departmentId = savedId/
  );
  assert.match(
    appSource,
    /const canonicalDepartment = \(state\.departments \|\| \[\]\)[\s\S]*?canonicalDepartment\?\.id \|\| rowId/
  );
  assert.match(mutationSource, /async function updateDepartments[\s\S]*?sql\.transaction\(queries\)/);
});

test("specialized settings controls use shared sequencing and granular capabilities", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const adminSource = fs.readFileSync(path.join(__dirname, "..", "settingsAdmin.js"), "utf8");
  const mutationSource = fs.readFileSync(
    path.join(__dirname, "..", "netlify", "functions", "mutate.js"),
    "utf8"
  );
  assert.match(appSource, /permissions\?\.manage_messaging_rules[\s\S]*?scheduleTask\(\s*`messaging-rule:/);
  assert.match(adminSource, /permissions\?\.edit_department_leads_settings[\s\S]*?scheduleTask\(\s*`department-lead:/);
  assert.match(adminSource, /permissions\?\.manage_settings_access[\s\S]*?scheduleTask\("permissions-matrix"/);
  assert.match(mutationSource, /case "update_notification_rule":[\s\S]*?manage_messaging_rules/);
  assert.match(mutationSource, /case "set_department_lead_assignment":[\s\S]*?edit_department_leads_settings/);
  assert.match(
    mutationSource,
    /const userLevel = normalizeLevel\(user\.level\);[\s\S]*?\!\[1, 2, 3\]\.includes\(userLevel\)/,
    "department leads should be globally eligible by Level 1/2/3"
  );
  assert.match(mutationSource, /case "update_user_rates":[\s\S]*?edit_member_rates/);
});

test("staff cannot view projects", () => {
  const allowed = perms.can(users.staffA, "view_projects", ctx({ actorProjectIds: [], projectId: "p1" }));
  assert.strictEqual(allowed, false);
});

test("admin can view projects in own office", () => {
  const allowed = perms.can(
    users.adminA,
    "view_projects",
    ctx({ resourceOfficeId: "A", actorOfficeId: "A", projectId: "p1", actorProjectIds: [] })
  );
  assert.strictEqual(allowed, true);
});

test("roleKeyFromUser normalizes global_admin to superuser", () => {
  const user = { permissionGroup: "global_admin" };
  assert.strictEqual(perms.roleKeyFromUser(user), "superuser");
});

test("can() grants global_admin same superuser access for member deactivation", () => {
  const allowed = perms.can(
    { id: "ga", permissionGroup: "global_admin", office_id: "A" },
    "deactivate_member",
    ctx({ resourceOfficeId: "B", actorOfficeId: "A", targetUserId: "target-1" })
  );
  assert.strictEqual(allowed, true);
});

test("roleKeyFromUser prefers normalized permission group over raw role", () => {
  const userWithGroup = { role: "stale", permission_group: "admin", level: 6 };
  assert.strictEqual(perms.roleKeyFromUser(userWithGroup), "admin");
  const userWithOnlyGroup = { permission_group: "admin" };
  assert.strictEqual(perms.roleKeyFromUser(userWithOnlyGroup), "admin");
});

test("can() uses normalized permission group from currentUser session payload", () => {
  const currentUser = { role: "stale", permission_group: "admin", office_id: "A" };
  const allowed = perms.can(currentUser, "view_clients", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, true);
  const denied = perms.can(currentUser, "view_clients", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(denied, false);
});

test("createUserRecord maps role from level mapping (DB-backed)", async () => {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.log("Skipping DB-dependent role mapping test; NETLIFY_DATABASE_URL not set.");
    return;
  }
  const sql = await db.getSql();
  await db.ensureSchema(sql);
  const accountId = await db.ensureDefaultAccount(sql);
  const payload = {
    username: `rolemap_${Date.now().toString(36)}`,
    displayName: "Role Map User",
    password: "password123",
    level: 3, // default mapping to manager per level_labels
    officeId: null,
    accountId,
  };
  const created = await db.createUserRecord(sql, payload);
  const refreshed = await db.findUserById(sql, created.id, accountId);
  const role = refreshed ? refreshed.role : created.role;
  assert.ok(role, "role should be set from level mapping");
  assert.strictEqual(role === "manager" || role === "staff", true, "role should map from level label");
});

test("admin cannot view unassigned cross-office projects", () => {
  const allowed = perms.can(
    users.adminA,
    "view_projects",
    ctx({ resourceOfficeId: "B", actorOfficeId: "A", projectId: "p1", actorProjectIds: [] })
  );
  assert.strictEqual(allowed, false);
});

test("admin can view assigned cross-office projects via assigned_projects scope", () => {
  const allowed = perms.can(
    users.adminA,
    "view_projects",
    ctx({ resourceOfficeId: "B", actorOfficeId: "A", projectId: "p1", actorProjectIds: ["p1"] })
  );
  assert.strictEqual(allowed, true);
});

test("manager scope includes projects where manager is a member", async () => {
  // Only a structural check on scope helper; use DB when available
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.log("Skipping DB-dependent manager scope test; NETLIFY_DATABASE_URL not set.");
    return;
  }
  const sql = await db.getSql();
  await db.ensureSchema(sql);
  const accountId = await db.ensureDefaultAccount(sql);

  // Seed one project, manager as member only
  const [{ id: clientId }] = await sql`
    INSERT INTO clients (account_id, name)
    VALUES (${accountId}::uuid, 'ScopeTestClient')
    ON CONFLICT (account_id, LOWER(name)) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  const [{ id: projectId }] = await sql`
    INSERT INTO projects (client_id, account_id, name)
    VALUES (${clientId}, ${accountId}::uuid, 'ScopeTestProject')
    ON CONFLICT (client_id, LOWER(name)) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  const managerId = "mgr-scope";
  await sql`
    INSERT INTO users (id, username, display_name, password_hash, role, level, account_id, is_active)
    VALUES (${managerId}, 'mgrscope', 'Mgr Scope', ${db.hashPassword("password123")}, 'manager', 3, ${accountId}::uuid, TRUE)
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO project_members (project_id, user_id, account_id)
    VALUES (${projectId}, ${managerId}, ${accountId}::uuid)
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;

  const scope = await db.getManagerScope(sql, managerId, accountId);
  assert.ok(scope.projectIds.includes(projectId), "manager scope should include projects where they are members");
});

test("admin can view clients in own office", () => {
  const allowed = perms.can(users.adminA, "view_clients", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("admin cannot view clients outside own office", () => {
  const allowed = perms.can(users.adminA, "view_clients", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("executive can view clients in own office", () => {
  const allowed = perms.can(users.execA, "view_clients", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("executive cannot view clients outside own office", () => {
  const allowed = perms.can(users.execA, "view_clients", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("superuser can view clients in any office", () => {
  const allowed = perms.can(users.superuser, "view_clients", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("staff cannot view clients", () => {
  const allowed = perms.can(users.staffA, "view_clients", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("manager cannot view clients unless allowed", () => {
  const allowed = perms.can(users.managerA, "view_clients", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("executive can view assigned cross-office projects", () => {
  const allowed = perms.can(
    users.execA,
    "view_projects",
    ctx({ resourceOfficeId: "B", actorOfficeId: "A", projectId: "p1", actorProjectIds: ["p1"] })
  );
  assert.strictEqual(allowed, true);
});

test("executive cannot view unassigned cross-office projects", () => {
  const allowed = perms.can(
    users.execA,
    "view_projects",
    ctx({ resourceOfficeId: "B", actorOfficeId: "A", projectId: "p1", actorProjectIds: [] })
  );
  assert.strictEqual(allowed, false);
});

test("admin can edit client via assigned projects", () => {
  const allowed = perms.can(users.adminA, "edit_client", ctx({ projectId: "p1", actorProjectIds: ["p1"] }));
  assert.strictEqual(allowed, true);
});

test("executive can edit client via assigned projects", () => {
  const allowed = perms.can(users.execA, "edit_client", ctx({ projectId: "p1", actorProjectIds: ["p1"] }));
  assert.strictEqual(allowed, true);
});

test("executive cannot edit client when not assigned", () => {
  const allowed = perms.can(users.execA, "edit_client", ctx({ projectId: "p1", actorProjectIds: [] }));
  assert.strictEqual(allowed, false);
});

test("admin can archive client in own office", () => {
  const allowed = perms.can(users.adminA, "archive_client", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("executive cannot archive client", () => {
  const allowed = perms.can(users.execA, "archive_client", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("superuser can create/edit/archive client globally", () => {
  const create = perms.can(users.superuser, "create_client", ctx({ resourceOfficeId: "Z" }));
  const edit = perms.can(users.superuser, "edit_client", ctx({ resourceOfficeId: "Z" }));
  const archive = perms.can(users.superuser, "archive_client", ctx({ resourceOfficeId: "Z" }));
  assert.strictEqual(create && edit && archive, true);
});

test("executive can view members in own office", () => {
  const allowed = perms.can(users.execA, "view_members", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("manager can view members in own office", () => {
  const allowed = perms.can(users.managerA, "view_members", ctx({ resourceOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("staff cannot view member rates", () => {
  const allowed = perms.can(users.staffA, "view_member_rates", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("admin can view settings shell in own office", () => {
  const allowed = perms.can(users.adminA, "view_settings_shell", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("admin can edit member rates in own office", () => {
  const allowed = perms.can(users.adminA, "edit_member_rates", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, true);
});

test("admin cannot edit member rates outside own office", () => {
  const allowed = perms.can(users.adminA, "edit_member_rates", ctx({ resourceOfficeId: "B", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("admin cannot manage non-rates settings capabilities", () => {
  const categories = perms.can(users.adminA, "manage_categories", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(categories, false);
});

test("admin cannot manage locations", () => {
  const locations = perms.can(users.adminA, "manage_locations", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(locations, false);
});

test("executive cannot edit member profile", () => {
  const allowed = perms.can(users.execA, "edit_member_profile", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("manager cannot reset passwords", () => {
  const allowed = perms.can(users.managerA, "admin_reset_password", ctx({ resourceOfficeId: "A", actorOfficeId: "A" }));
  assert.strictEqual(allowed, false);
});

test("superuser can access all settings capabilities globally", () => {
  const shell = perms.can(users.superuser, "view_settings_shell", ctx({ resourceOfficeId: "Z" }));
  const rates = perms.can(users.superuser, "edit_member_rates", ctx({ resourceOfficeId: "Z" }));
  const cats = perms.can(users.superuser, "manage_categories", ctx({ resourceOfficeId: "Z" }));
  const locs = perms.can(users.superuser, "manage_locations", ctx({ resourceOfficeId: "Z" }));
  assert.strictEqual(shell && rates && cats && locs, true);
});

test("planning budgets are restricted to projects the actor can plan", () => {
  const stateSource = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "state.js"), "utf8");
  assert.match(stateSource, /project_id = ANY\(\$\{planningProjectIds\.length \? planningProjectIds : \[0\]\}::bigint\[\]\)/);
  assert.match(stateSource, /isLead \|\| isExecutive \|\| can\(context\.currentUser, "edit_project_planning"/);
});

test("ordinary admins receive only scoped project assignments", () => {
  const dbSource = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "_db.js"), "utf8");
  assert.match(dbSource, /if \(currentGroup === "superuser"\) \{[\s\S]*?listManagerClientAssignments\(sql, accountUuid\)/);
  assert.match(dbSource, /actorPlanningRoleProjectIds = Array\.from\(new Set\(\[[\s\S]*?actorExecutiveProjectIds/);
});

test("entry catalog excludes unrelated account projects", () => {
  const dbSource = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "_db.js"), "utf8");
  assert.match(dbSource, /catalogProjectIdSet = new Set\(\[[\s\S]*?actorDirectAssignedProjectIds/);
  assert.match(dbSource, /catalogProjectIdSet\.has\(projectId\)/);
  assert.doesNotMatch(dbSource, /const catalogRows = await sql/);
});

test("project-reference users do not expose full member profiles", () => {
  const dbSource = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "_db.js"), "utf8");
  assert.match(dbSource, /const visibleUser = canViewProfile[\s\S]*?displayName:[\s\S]*?departmentName:/);
  const minimalShape = dbSource.match(/const visibleUser = canViewProfile[\s\S]*?return \{\s*\.\.\.visibleUser,/i)?.[0] || "";
  assert.doesNotMatch(minimalShape, /email:/);
  assert.doesNotMatch(minimalShape, /employeeId:/);
  assert.doesNotMatch(minimalShape, /memberProfile:/);
});

test("analytics capabilities are controlled by the live matrix", () => {
  const analyticsIndex = indexFromRows([
    {
      role_key: "admin",
      capability_key: "view_office_analytics",
      scope_key: "all_offices",
      allowed: true,
    },
  ]);
  assert.strictEqual(
    perms.can(users.adminA, "view_office_analytics", {}, analyticsIndex),
    true
  );
  assert.strictEqual(
    perms.can(users.adminA, "view_company_analytics", {}, analyticsIndex),
    false
  );
  assert.strictEqual(
    perms.can(users.superuser, "view_company_analytics", {}, analyticsIndex),
    false,
    "superusers must not bypass analytics matrix controls"
  );
});

test("own-record edit blocked once approved for non-admin", () => {
  const beforeApproval = perms.can(
    users.staffA,
    "edit_expense",
    ctx({ actorIsOwner: true, recordStatus: "pending" })
  );
  const afterApproval = perms.can(
    users.staffA,
    "edit_expense",
    ctx({ actorIsOwner: true, recordStatus: "approved" })
  );
  assert.strictEqual(beforeApproval, true);
  assert.strictEqual(afterApproval, false);
});

test("admin approved-entry override allowed", () => {
  const allowed = perms.can(
    users.adminA,
    "edit_expense",
    ctx({ actorOfficeId: "A", resourceOfficeId: "A", recordStatus: "approved" })
  );
  assert.strictEqual(allowed, true);
});
