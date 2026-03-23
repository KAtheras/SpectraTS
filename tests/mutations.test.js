"use strict";

const assert = require("assert");
const crypto = require("crypto");
const mutate = require("../netlify/functions/mutate");
const db = require("../netlify/functions/_db");

const PROTECTED_ACCOUNTS = new Set([
  "3ad1b415-22fe-41b6-a394-d22f1f53dfd5", // ACME
  "55f382d9-524f-46ef-b222-0167218a8c79", // Spectra
]);

const TEST_ACCOUNT_ID = process.env.TEST_ACCOUNT_ID;
const TEST_ACCOUNT_NAME = process.env.TEST_ACCOUNT_NAME || "ZZ Automation Test Account";
const OFFICE_ID = "office-test-1";

if (!TEST_ACCOUNT_ID) {
  console.error("TEST_ACCOUNT_ID env var is required for mutation tests.");
  process.exit(1);
}

if (PROTECTED_ACCOUNTS.has(TEST_ACCOUNT_ID)) {
  console.error("Refusing to run mutation tests against protected account.");
  process.exit(1);
}

function rand(label) {
  return `${label}_${crypto.randomBytes(4).toString("hex")}`;
}

function test(name, fn) {
  tests.push({ name, fn });
}

const tests = [];

async function callMutation(action, payload, token) {
  const event = {
    httpMethod: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  };
  const res = await mutate.handler(event);
  const parsed = typeof res.body === "string" ? JSON.parse(res.body) : res.body;
  return { statusCode: res.statusCode, body: parsed };
}

async function ensureTestAccount(sql) {
  await sql`
    INSERT INTO accounts (id, name)
    VALUES (${TEST_ACCOUNT_ID}::uuid, ${TEST_ACCOUNT_NAME})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO office_locations (id, account_id, name)
    VALUES (${OFFICE_ID}, ${TEST_ACCOUNT_ID}::uuid, 'Test Office')
    ON CONFLICT (id) DO NOTHING
  `;
}

async function cleanupAccount(sql) {
  const accountId = TEST_ACCOUNT_ID;
  await sql`DELETE FROM audit_log WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM expenses WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM entries WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM manager_projects WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM manager_clients WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM project_members WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM projects WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM clients WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE account_id = ${accountId}::uuid)`;
  await sql`DELETE FROM users WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM expense_categories WHERE account_uuid = ${accountId}::uuid`;
  await sql`DELETE FROM level_labels WHERE account_id = ${accountId}::uuid`;
  await sql`DELETE FROM office_locations WHERE account_id = ${accountId}::uuid AND id <> ${OFFICE_ID}`;
}

async function seedLevelLabels(sql) {
  const defaults = [
    { level: 1, label: "Staff", permission_group: "staff" },
    { level: 3, label: "Manager", permission_group: "manager" },
    { level: 5, label: "Admin", permission_group: "admin" },
    { level: 6, label: "Superuser", permission_group: "superuser" },
  ];
  for (const row of defaults) {
    await sql`
      INSERT INTO level_labels (account_id, level, label, permission_group)
      VALUES (${TEST_ACCOUNT_ID}::uuid, ${row.level}, ${row.label}, ${row.permission_group})
      ON CONFLICT (account_id, level) DO UPDATE SET label = EXCLUDED.label, permission_group = EXCLUDED.permission_group
    `;
  }
}

async function insertUser(sql, { id, username, displayName, role, level, officeId }) {
  const now = new Date().toISOString();
  const passwordHash = db.hashPassword("P@ssw0rd!");
  await sql`
    INSERT INTO users (
      id, username, display_name, password_hash, role, level, account_id, office_id,
      is_active, created_at, updated_at
    )
    VALUES (
      ${id}, ${username}, ${displayName}, ${passwordHash}, ${role}, ${level},
      ${TEST_ACCOUNT_ID}::uuid, ${officeId}, TRUE, ${now}, ${now}
    )
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, level = EXCLUDED.level, office_id = EXCLUDED.office_id, is_active = TRUE
  `;
  return { id, username, displayName, role, level, officeId };
}

async function setupSuperuser(sql) {
  const su = {
    id: "user-super",
    username: "superuser",
    displayName: "Super User",
    role: "superuser",
    level: 6,
    officeId: OFFICE_ID,
  };
  await insertUser(sql, su);
  const session = await db.createSession(sql, su.id);
  return { user: su, token: session.token };
}

async function withSql(fn) {
  const sql = await db.getSql();
  await db.ensureSchema(sql);
  await ensureTestAccount(sql);
  await seedLevelLabels(sql);
  await fn(sql);
}

// ---------------- Tests ----------------

test("add/update/reset/deactivate user", async () => {
  await withSql(async (sql) => {
    await cleanupAccount(sql);
    await ensureTestAccount(sql);
    await seedLevelLabels(sql);
    const { token } = await setupSuperuser(sql);

    // add_user
    const username = rand("user");
    let res = await callMutation("add_user", {
      username,
      displayName: `User ${username}`,
      password: "Secret123",
      level: 3,
      officeId: OFFICE_ID,
      accountId: TEST_ACCOUNT_ID,
    }, token);
    assert.strictEqual(res.statusCode, 200, `add_user: ${JSON.stringify(res.body)}`);

    const added = (await sql`SELECT * FROM users WHERE username = ${username} AND account_id = ${TEST_ACCOUNT_ID}::uuid`)[0];
    assert.ok(added);

    // update_user
    const newName = `${added.display_name} Jr.`;
    res = await callMutation("update_user", {
      userId: added.id,
      displayName: newName,
      username,
      level: 3,
      officeId: OFFICE_ID,
    }, token);
    assert.strictEqual(res.statusCode, 200, `update_user: ${JSON.stringify(res.body)}`);
    const updated = (await sql`SELECT display_name FROM users WHERE id = ${added.id}`)[0];
    assert.strictEqual(updated.display_name, newName);

    // reset_user_password
    const beforeHash = added.password_hash;
    res = await callMutation("reset_user_password", { userId: added.id, password: "NewPass123" }, token);
    assert.strictEqual(res.statusCode, 200, `reset_user_password: ${JSON.stringify(res.body)}`);
    const after = (await sql`SELECT password_hash FROM users WHERE id = ${added.id}`)[0];
    assert.notStrictEqual(after.password_hash, beforeHash);

    // change_own_password (superuser)
    const suBefore = (await sql`SELECT password_hash FROM users WHERE id = 'user-super'`)[0].password_hash;
    res = await callMutation("change_own_password", { currentPassword: "P@ssw0rd!", newPassword: "OwnPass999" }, token);
    assert.strictEqual(res.statusCode, 200, `change_own_password: ${JSON.stringify(res.body)}`);
    const suAfter = (await sql`SELECT password_hash FROM users WHERE id = 'user-super'`)[0].password_hash;
    assert.notStrictEqual(suAfter, suBefore);

    // deactivate_user
    res = await callMutation("deactivate_user", { userId: added.id }, token);
    assert.strictEqual(res.statusCode, 200, `deactivate_user: ${JSON.stringify(res.body)}`);
    const inactive = (await sql`SELECT is_active FROM users WHERE id = ${added.id}`)[0];
    assert.strictEqual(inactive.is_active, false);
  });
});

test("clients and projects add/update/remove with assignments", async () => {
  await withSql(async (sql) => {
    await cleanupAccount(sql);
    await ensureTestAccount(sql);
    await seedLevelLabels(sql);
    const { token } = await setupSuperuser(sql);

    const clientName = rand("Client");
    let res = await callMutation("add_client", { clientName, officeId: OFFICE_ID }, token);
    assert.strictEqual(res.statusCode, 200, `add_client: ${JSON.stringify(res.body)}`);
    const client = (await sql`SELECT id, name FROM clients WHERE account_id = ${TEST_ACCOUNT_ID}::uuid AND name = ${clientName}`)[0];
    assert.ok(client);

    const updatedName = `${clientName}-Renamed`;
    res = await callMutation("rename_client", { clientName, nextName: updatedName }, token);
    assert.strictEqual(res.statusCode, 200, `rename_client: ${JSON.stringify(res.body)}`);
    const renamed = (await sql`SELECT name FROM clients WHERE id = ${client.id}`)[0];
    assert.strictEqual(renamed.name, updatedName);

    res = await callMutation("update_client", { clientName: updatedName, billingContactEmail: "billing@example.com" }, token);
    assert.strictEqual(res.statusCode, 200, `update_client: ${JSON.stringify(res.body)}`);
    const updated = (await sql`SELECT billing_contact_email FROM clients WHERE id = ${client.id}`)[0];
    assert.strictEqual(updated.billing_contact_email, "billing@example.com");

    // project
    const projectName = rand("Project");
    res = await callMutation("add_project", { clientName: updatedName, projectName, officeId: OFFICE_ID }, token);
    assert.strictEqual(res.statusCode, 200, `add_project: ${JSON.stringify(res.body)}`);
    const project = (await sql`SELECT id, name FROM projects WHERE client_id = ${client.id} AND name = ${projectName}`)[0];
    assert.ok(project);

    const renamedProject = `${projectName}-R`;
    res = await callMutation("rename_project", { clientName: updatedName, projectName, nextName: renamedProject }, token);
    assert.strictEqual(res.statusCode, 200, `rename_project: ${JSON.stringify(res.body)}`);
    const projRenamed = (await sql`SELECT name FROM projects WHERE id = ${project.id}`)[0];
    assert.strictEqual(projRenamed.name, renamedProject);

    res = await callMutation("update_project", { clientName: updatedName, projectName: renamedProject, budgetAmount: 5000 }, token);
    assert.strictEqual(res.statusCode, 200, `update_project: ${JSON.stringify(res.body)}`);
    const projUpdated = (await sql`SELECT budget_amount FROM projects WHERE id = ${project.id}`)[0];
    assert.strictEqual(Number(projUpdated.budget_amount), 5000);

    // manager assign/unassign
    const manager = await insertUser(sql, {
      id: rand("mgr"),
      username: rand("mgrU"),
      displayName: "Mgr",
      role: "manager",
      level: 3,
      officeId: OFFICE_ID,
    });

    res = await callMutation("assign_manager_client", { managerId: manager.id, clientName: updatedName }, token);
    assert.strictEqual(res.statusCode, 200, `assign_manager_client: ${JSON.stringify(res.body)}`);
    const mc = (await sql`SELECT 1 FROM manager_clients WHERE manager_id = ${manager.id} AND client_id = ${client.id}`)[0];
    assert.ok(mc);

    res = await callMutation("assign_manager_project", { managerId: manager.id, clientName: updatedName, projectName: renamedProject, chargeRateOverride: 150 }, token);
    assert.strictEqual(res.statusCode, 200, `assign_manager_project: ${JSON.stringify(res.body)}`);
    const mp = (await sql`SELECT charge_rate_override FROM manager_projects WHERE manager_id = ${manager.id} AND project_id = ${project.id}`)[0];
    assert.strictEqual(Number(mp.charge_rate_override), 150);

    res = await callMutation("update_manager_project_rate", { managerId: manager.id, clientName: updatedName, projectName: renamedProject, chargeRateOverride: 175 }, token);
    assert.strictEqual(res.statusCode, 200, `update_manager_project_rate: ${JSON.stringify(res.body)}`);
    const mpUpdated = (await sql`SELECT charge_rate_override FROM manager_projects WHERE manager_id = ${manager.id} AND project_id = ${project.id}`)[0];
    assert.strictEqual(Number(mpUpdated.charge_rate_override), 175);

    res = await callMutation("unassign_manager_project", { managerId: manager.id, clientName: updatedName, projectName: renamedProject }, token);
    assert.strictEqual(res.statusCode, 200, `unassign_manager_project: ${JSON.stringify(res.body)}`);
    const mpGone = (await sql`SELECT 1 FROM manager_projects WHERE manager_id = ${manager.id} AND project_id = ${project.id}`)[0];
    assert.ok(!mpGone);

    res = await callMutation("unassign_manager_client", { managerId: manager.id, clientName: updatedName }, token);
    assert.strictEqual(res.statusCode, 200, `unassign_manager_client: ${JSON.stringify(res.body)}`);
    const mcGone = (await sql`SELECT 1 FROM manager_clients WHERE manager_id = ${manager.id} AND client_id = ${client.id}`)[0];
    assert.ok(!mcGone);

    // remove project/client
    res = await callMutation("remove_project", { clientName: updatedName, projectName: renamedProject }, token);
    assert.strictEqual(res.statusCode, 200, `remove_project: ${JSON.stringify(res.body)}`);
    const removedProject = (await sql`SELECT 1 FROM projects WHERE id = ${project.id}`)[0];
    assert.ok(!removedProject);

    res = await callMutation("remove_client", { clientName: updatedName }, token);
    assert.strictEqual(res.statusCode, 200, `remove_client: ${JSON.stringify(res.body)}`);
    const removedClient = (await sql`SELECT 1 FROM clients WHERE id = ${client.id}`)[0];
    assert.ok(!removedClient);
  });
});

test("project members add/update/remove", async () => {
  await withSql(async (sql) => {
    await cleanupAccount(sql);
    await ensureTestAccount(sql);
    await seedLevelLabels(sql);
    const { token } = await setupSuperuser(sql);

    const clientName = rand("Client");
    const projectName = rand("Project");
    await callMutation("add_client", { clientName, officeId: OFFICE_ID }, token);
    await callMutation("add_project", { clientName, projectName, officeId: OFFICE_ID }, token);
    const project = (await sql`SELECT id FROM projects WHERE name = ${projectName} AND account_id = ${TEST_ACCOUNT_ID}::uuid`)[0];

    const staff = await insertUser(sql, {
      id: rand("staff"),
      username: rand("st"),
      displayName: "Staff",
      role: "staff",
      level: 1,
      officeId: OFFICE_ID,
    });

    let res = await callMutation("add_project_member", { userId: staff.id, clientName, projectName }, token);
    assert.strictEqual(res.statusCode, 200, `add_project_member: ${JSON.stringify(res.body)}`);
    const pm = (await sql`SELECT 1 FROM project_members WHERE project_id = ${project.id} AND user_id = ${staff.id}`)[0];
    assert.ok(pm);

    res = await callMutation("update_project_member_rate", { userId: staff.id, clientName, projectName, chargeRateOverride: 99 }, token);
    assert.strictEqual(res.statusCode, 200, `update_project_member_rate: ${JSON.stringify(res.body)}`);
    const pmRate = (await sql`SELECT charge_rate_override FROM project_members WHERE project_id = ${project.id} AND user_id = ${staff.id}`)[0];
    assert.strictEqual(Number(pmRate.charge_rate_override), 99);

    res = await callMutation("remove_project_member", { userId: staff.id, clientName, projectName }, token);
    assert.strictEqual(res.statusCode, 200, `remove_project_member: ${JSON.stringify(res.body)}`);
    const pmGone = (await sql`SELECT 1 FROM project_members WHERE project_id = ${project.id} AND user_id = ${staff.id}`)[0];
    assert.ok(!pmGone);
  });
});

test("entries lifecycle", async () => {
  await withSql(async (sql) => {
    await cleanupAccount(sql);
    await ensureTestAccount(sql);
    await seedLevelLabels(sql);
    const { token, user } = await setupSuperuser(sql);

    const clientName = rand("Client");
    const projectName = rand("Project");
    await callMutation("add_client", { clientName, officeId: OFFICE_ID }, token);
    await callMutation("add_project", { clientName, projectName, officeId: OFFICE_ID }, token);

    const entryId = crypto.randomUUID();
    const date = "2025-01-02";

    let res = await callMutation("save_entry", {
      entry: {
        id: entryId,
        user: user.displayName,
        date,
        client: clientName,
        project: projectName,
        task: "Testing",
        hours: 2,
        notes: "note",
        billable: true,
      }
    }, token);
    assert.strictEqual(res.statusCode, 200, `save_entry: ${JSON.stringify(res.body)}`);
    const entry = (await sql`SELECT status FROM entries WHERE id = ${entryId}`)[0];
    assert.ok(entry);

    res = await callMutation("approve_entry", { id: entryId }, token);
    assert.strictEqual(res.statusCode, 200, `approve_entry: ${JSON.stringify(res.body)}`);
    const approved = (await sql`SELECT status FROM entries WHERE id = ${entryId}`)[0];
    assert.strictEqual(approved.status, "approved");

    res = await callMutation("unapprove_entry", { id: entryId }, token);
    assert.strictEqual(res.statusCode, 200, `unapprove_entry: ${JSON.stringify(res.body)}`);
    const pending = (await sql`SELECT status FROM entries WHERE id = ${entryId}`)[0];
    assert.strictEqual(pending.status, "pending");

    res = await callMutation("delete_entry", { id: entryId }, token);
    assert.strictEqual(res.statusCode, 200, `delete_entry: ${JSON.stringify(res.body)}`);
    const gone = (await sql`SELECT 1 FROM entries WHERE id = ${entryId}`)[0];
    assert.ok(!gone);
  });
});

test("expenses lifecycle", async () => {
  await withSql(async (sql) => {
    await cleanupAccount(sql);
    await ensureTestAccount(sql);
    await seedLevelLabels(sql);
    const { token, user } = await setupSuperuser(sql);

    const clientName = rand("Client");
    const projectName = rand("Project");
    await callMutation("add_client", { clientName, officeId: OFFICE_ID }, token);
    await callMutation("add_project", { clientName, projectName, officeId: OFFICE_ID }, token);

    const expenseId = rand("exp");
    let res = await callMutation("create_expense", {
      expense: {
        id: expenseId,
        userId: user.id,
        clientName,
        projectName,
        expenseDate: "2025-01-03",
        category: "Travel",
        amount: 100,
        isBillable: 1,
        notes: "trip",
      }
    }, token);
    assert.strictEqual(res.statusCode, 200, `create_expense: ${JSON.stringify(res.body)}`);
    const created = (await sql`SELECT amount, status FROM expenses WHERE id = ${expenseId}`)[0];
    assert.strictEqual(Number(created.amount), 100);

    res = await callMutation("update_expense", { expense: { id: expenseId, amount: 120, notes: "updated", expenseDate: "2025-01-03", clientName, projectName, userId: user.id, category: "Travel" } }, token);
    assert.strictEqual(res.statusCode, 200, `update_expense: ${JSON.stringify(res.body)}`);
    const updated = (await sql`SELECT amount, notes FROM expenses WHERE id = ${expenseId}`)[0];
    assert.strictEqual(Number(updated.amount), 120);
    assert.strictEqual(updated.notes, "updated");

    res = await callMutation("toggle_expense_status", { id: expenseId, status: "approved" }, token);
    assert.strictEqual(res.statusCode, 200, `toggle_expense_status: ${JSON.stringify(res.body)}`);
    const approved = (await sql`SELECT status FROM expenses WHERE id = ${expenseId}`)[0];
    assert.strictEqual(approved.status, "approved");

    res = await callMutation("delete_expense", { id: expenseId }, token);
    assert.strictEqual(res.statusCode, 200, `delete_expense: ${JSON.stringify(res.body)}`);
    const gone = (await sql`SELECT 1 FROM expenses WHERE id = ${expenseId}`)[0];
    assert.ok(!gone);
  });
});

test("settings tables updates", async () => {
  await withSql(async (sql) => {
    await cleanupAccount(sql);
    await ensureTestAccount(sql);
    await seedLevelLabels(sql);
    const { token } = await setupSuperuser(sql);

    const levelsPayload = [{ level: 2, label: "Senior", permissionGroup: "manager" }];
    let res = await callMutation("update_level_labels", { levels: levelsPayload }, token);
    assert.strictEqual(res.statusCode, 200, `update_level_labels: ${JSON.stringify(res.body)}`);
    const ll = (await sql`SELECT permission_group FROM level_labels WHERE account_id = ${TEST_ACCOUNT_ID}::uuid AND level = 2`)[0];
    assert.strictEqual(ll.permission_group, "manager");

    const categories = [
      { id: rand("cat1"), name: "Travel", isActive: true },
      { id: rand("cat2"), name: "Meals", isActive: true },
      { id: rand("cat3"), name: rand("Cat") },
    ];
    res = await callMutation("update_expense_categories", { categories }, token);
    assert.strictEqual(res.statusCode, 200, `update_expense_categories: ${JSON.stringify(res.body)}`);
    const catRow = (await sql`SELECT name FROM expense_categories WHERE account_uuid = ${TEST_ACCOUNT_ID}::uuid AND name = ${categories[2].name}`)[0];
    assert.ok(catRow);

    const offices = [{ id: OFFICE_ID, name: "Test Office" }, { id: "office-2", name: "Office 2" }];
    res = await callMutation("update_office_locations", { locations: offices }, token);
    assert.strictEqual(res.statusCode, 200, `update_office_locations: ${JSON.stringify(res.body)}`);
    const offRow = (await sql`SELECT name FROM office_locations WHERE account_id = ${TEST_ACCOUNT_ID}::uuid AND id = 'office-2'`)[0];
    assert.strictEqual(offRow.name, "Office 2");
  });
});

async function main() {
  if (!process.env.NETLIFY_DATABASE_URL) {
    console.error("NETLIFY_DATABASE_URL is required for mutation tests.");
    process.exit(1);
  }

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✔ ${t.name}`);
    } catch (error) {
      console.error(`✖ ${t.name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
}

main();

// Run with:
// TEST_ACCOUNT_ID=<uuid> NETLIFY_DATABASE_URL=<conn> node tests/mutations.test.js
