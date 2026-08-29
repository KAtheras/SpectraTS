"use strict";

module.exports = {
  id: "004_project_closeout",
  async up(sql) {
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ongoing'`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_out_at DATE`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_out_by TEXT REFERENCES users(id)`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closeout_notes TEXT`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closeout_billing_note TEXT`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closeout_deliverables_confirmed BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closeout_records_confirmed BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closeout_planning_confirmed BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS closeout_billing_reviewed BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pre_close_percent_complete NUMERIC(5,2)`;

    await sql`
      INSERT INTO permission_capabilities (key, label, category, is_active)
      VALUES ('close_project', 'Close out or reopen projects within assigned leadership scope', 'clients_projects', TRUE)
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        is_active = EXCLUDED.is_active
    `;
    await sql`
      INSERT INTO role_permissions (role_id, capability_id, scope_id, allowed)
      SELECT pr.id, pc.id, ps.id, TRUE
      FROM (VALUES ('staff'), ('manager'), ('executive'), ('admin'), ('superuser')) defaults(role_key)
      JOIN permission_roles pr ON pr.key = defaults.role_key
      JOIN permission_capabilities pc ON pc.key = 'close_project'
      JOIN permission_scopes ps ON ps.key = 'all_offices'
      ON CONFLICT (role_id, capability_id, scope_id) DO NOTHING
    `;
  },
};
