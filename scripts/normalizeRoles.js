#!/usr/bin/env node
"use strict";

const db = require("../netlify/functions/_db");

(async () => {
  try {
    const sql = await db.getSql();
    await db.ensureSchema(sql);
    const result = await sql`
      UPDATE users
      SET role = 'superuser'
      WHERE role = 'global_admin'
      RETURNING id, username, display_name AS "displayName"
    `;
    console.log(`Updated ${result.length} user(s) from global_admin to superuser.`);
  } catch (error) {
    console.error("Failed to normalize roles:", error.message);
    process.exit(1);
  }
})();

