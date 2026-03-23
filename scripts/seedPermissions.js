"use strict";

const path = require("path");
const db = require("../netlify/functions/_db");
const permissions = require("../netlify/functions/permissions");

async function main() {
  const workbookPath = path.join(__dirname, "..", "final_permission_spec_clean.xlsx");
  const sql = await db.getSql();
  await db.ensureSchema(sql);

  const records = permissions.parseWorkbook(workbookPath);
  const structs = permissions.buildStructures(records);

  // Upsert roles
  for (const role of structs.roles) {
    await sql`
      INSERT INTO permission_roles (key, label, is_global, is_active)
      VALUES (${role.key}, ${role.label}, ${role.is_global}, ${role.is_active})
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        is_global = EXCLUDED.is_global,
        is_active = EXCLUDED.is_active
    `;
  }

  // Upsert scopes
  for (const scope of structs.scopes) {
    await sql`
      INSERT INTO permission_scopes (key, label, is_active)
      VALUES (${scope.key}, ${scope.label}, ${scope.is_active})
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        is_active = EXCLUDED.is_active
    `;
  }

  // Upsert capabilities
  for (const cap of structs.capabilities) {
    await sql`
      INSERT INTO permission_capabilities (key, label, category, is_active)
      VALUES (${cap.key}, ${cap.label}, ${cap.category}, ${cap.is_active})
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        is_active = EXCLUDED.is_active
    `;
  }

  // Build key -> id maps
  const roleRows = await sql`SELECT id, key FROM permission_roles`;
  const capRows = await sql`SELECT id, key FROM permission_capabilities`;
  const scopeRows = await sql`SELECT id, key FROM permission_scopes`;
  const roleId = Object.fromEntries(roleRows.map((r) => [r.key, r.id]));
  const capId = Object.fromEntries(capRows.map((r) => [r.key, r.id]));
  const scopeId = Object.fromEntries(scopeRows.map((r) => [r.key, r.id]));

  for (const perm of structs.permissions) {
    const rId = roleId[perm.role_key];
    const cId = capId[perm.capability_key];
    const sId = scopeId[perm.scope_key];
    if (!rId || !cId || !sId) continue;
    await sql`
      INSERT INTO role_permissions (
        role_id,
        capability_id,
        scope_id,
        allowed,
        subject_role_max,
        allow_self,
        policy_key
      )
      VALUES (
        ${rId},
        ${cId},
        ${sId},
        ${perm.allowed},
        ${perm.subject_role_max},
        ${perm.allow_self},
        ${perm.policy_key}
      )
      ON CONFLICT (role_id, capability_id, scope_id) DO UPDATE SET
        allowed = EXCLUDED.allowed,
        subject_role_max = EXCLUDED.subject_role_max,
        allow_self = EXCLUDED.allow_self,
        policy_key = EXCLUDED.policy_key
    `;
  }

  console.log("Permission tables seeded from workbook.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
