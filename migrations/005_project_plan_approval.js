"use strict";

module.exports = {
  id: "005_project_plan_approval",
  async up(sql) {
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_executive_id TEXT REFERENCES users(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning_submitted_at TIMESTAMPTZ`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning_submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning_reviewed_at TIMESTAMPTZ`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning_reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS planning_review_notes TEXT`;

    await sql`
      INSERT INTO permission_capabilities (key, label, category, is_active)
      VALUES
        ('create_project', 'Can create projects', 'clients_projects', TRUE),
        ('manage_project_activation', 'Can deactivate or reactivate projects', 'clients_projects', TRUE),
        ('remove_project', 'Can permanently remove projects', 'clients_projects', TRUE),
        ('submit_project_plan', 'Can submit project plans for approval', 'clients_projects', TRUE),
        ('approve_project_plan', 'Can serve as Project Executive and review project plans', 'clients_projects', TRUE)
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        is_active = EXCLUDED.is_active
    `;
    await sql`UPDATE permission_capabilities SET is_active = FALSE WHERE key = 'manage_projects_lifecycle'`;

    await sql`
      INSERT INTO role_permissions (role_id, capability_id, scope_id, allowed)
      SELECT old_rp.role_id, new_cap.id, old_rp.scope_id, old_rp.allowed
      FROM role_permissions old_rp
      JOIN permission_capabilities old_cap ON old_cap.id = old_rp.capability_id
      CROSS JOIN permission_capabilities new_cap
      WHERE old_cap.key = 'manage_projects_lifecycle'
        AND new_cap.key IN ('create_project', 'manage_project_activation', 'remove_project')
      ON CONFLICT (role_id, capability_id, scope_id) DO NOTHING
    `;

    await sql`
      INSERT INTO role_permissions (role_id, capability_id, scope_id, allowed)
      SELECT pr.id, pc.id, ps.id, TRUE
      FROM (VALUES
        ('staff', 'submit_project_plan'),
        ('manager', 'submit_project_plan'),
        ('executive', 'submit_project_plan'),
        ('admin', 'submit_project_plan'),
        ('superuser', 'submit_project_plan'),
        ('admin', 'approve_project_plan'),
        ('superuser', 'approve_project_plan')
      ) defaults(role_key, capability_key)
      JOIN permission_roles pr ON pr.key = defaults.role_key
      JOIN permission_capabilities pc ON pc.key = defaults.capability_key
      JOIN permission_scopes ps ON ps.key = 'all_offices'
      ON CONFLICT (role_id, capability_id, scope_id) DO NOTHING
    `;
  },
};
