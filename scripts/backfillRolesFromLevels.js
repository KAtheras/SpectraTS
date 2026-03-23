#!/usr/bin/env node
"use strict";

const db = require("../netlify/functions/_db");

(async () => {
  try {
    const sql = await db.getSql();
    await db.ensureSchema(sql);
    const accountId = await db.ensureDefaultAccount(sql);
    const levelLabels = await db.listLevelLabels(sql, accountId);

    const updates = await sql`
      UPDATE users u
      SET role = ll.permission_group
      FROM level_labels ll
      WHERE u.account_id = ll.account_id
        AND u.level = ll.level
        AND ll.permission_group IS NOT NULL
        AND u.role IS DISTINCT FROM ll.permission_group
    `;

    const globals = await sql`
      UPDATE users
      SET role = 'superuser'
      WHERE role = 'global_admin'
    `;

    console.log(`Roles synced from levels: ${updates.count || updates.length || 0}`);
    console.log(`global_admin -> superuser updates: ${globals.count || globals.length || 0}`);
  } catch (error) {
    console.error("Backfill failed:", error.message);
    process.exit(1);
  }
})();
