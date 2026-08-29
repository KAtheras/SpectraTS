"use strict";

const { getSql } = require("../netlify/functions/_db");

const migrations = [
  require("../migrations/001_baseline"),
  require("../migrations/002_office_overhead_percent"),
  require("../migrations/003_analytics_permissions"),
  require("../migrations/004_project_closeout"),
  require("../migrations/005_project_plan_approval"),
  require("../migrations/006_weekly_approval_workflow"),
];

async function run() {
  const sql = await getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const appliedRows = await sql`SELECT id FROM schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      process.stdout.write(`Already applied: ${migration.id}\n`);
      continue;
    }

    process.stdout.write(`Applying: ${migration.id}\n`);
    await migration.up(sql);
    await sql`
      INSERT INTO schema_migrations (id)
      VALUES (${migration.id})
      ON CONFLICT (id) DO NOTHING
    `;
    process.stdout.write(`Applied: ${migration.id}\n`);
  }
}

run().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
