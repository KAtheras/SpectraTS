"use strict";

module.exports = {
  id: "003_analytics_permissions",
  async up(sql) {
    await sql`
      INSERT INTO permission_capabilities (key, label, category, is_active)
      VALUES
        ('view_company_analytics', 'View company-wide analytics', 'analytics', TRUE),
        ('view_office_analytics', 'View analytics for offices they lead', 'analytics', TRUE),
        ('view_department_analytics', 'View analytics for office / departments they lead', 'analytics', TRUE),
        ('view_project_analytics', 'View analytics for projects they lead', 'analytics', TRUE)
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        is_active = EXCLUDED.is_active
    `;

    await sql`
      INSERT INTO role_permissions (role_id, capability_id, scope_id, allowed)
      SELECT pr.id, pc.id, ps.id, TRUE
      FROM (VALUES
        ('superuser', 'view_company_analytics'),
        ('admin', 'view_office_analytics'),
        ('superuser', 'view_office_analytics'),
        ('executive', 'view_department_analytics'),
        ('admin', 'view_department_analytics'),
        ('superuser', 'view_department_analytics'),
        ('staff', 'view_project_analytics'),
        ('manager', 'view_project_analytics'),
        ('executive', 'view_project_analytics'),
        ('admin', 'view_project_analytics'),
        ('superuser', 'view_project_analytics')
      ) AS defaults(role_key, capability_key)
      JOIN permission_roles pr ON pr.key = defaults.role_key
      JOIN permission_capabilities pc ON pc.key = defaults.capability_key
      JOIN permission_scopes ps ON ps.key = 'all_offices'
      ON CONFLICT (role_id, capability_id, scope_id) DO NOTHING
    `;
  },
};
