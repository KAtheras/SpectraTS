"use strict";

const db = require("../netlify/functions/_db");
const permissions = require("../netlify/functions/permissions");

async function main() {
  const sql = await db.getSql();
  await db.ensureSchema(sql);

  const rows = await permissions.loadPermissionsFromDb(sql);
  const filtered = rows.filter((row) =>
    row.capability_key === "view_members" ||
    row.capability_key === "view_member_rates"
  );

  console.log("Permission rows (view_members / view_member_rates):");
  for (const r of filtered) {
    console.log(
      `${r.role_key} -> ${r.capability_key} @ ${r.scope_key} allowed=${r.allowed} subject_max=${r.subject_role_max} allow_self=${r.allow_self}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
