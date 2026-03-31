"use strict";

const {
  ensureSchema,
  errorResponse,
  getSessionContext,
  getSql,
  json,
  loadState,
  requireAuth,
} = require("./_db");
const { can, buildIndex, loadPermissionsFromDb } = require("./permissions");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    const sql = await getSql();
    await ensureSchema(sql);
    const context = await getSessionContext(sql, event);
    const authError = requireAuth(context);
    if (authError) {
      return authError;
    }

    const permissionRows = await loadPermissionsFromDb(sql);
    const permissionIndex = buildIndex({ permissions: permissionRows });
    const state = await loadState(sql, context.currentUser);
    const currentUser = state.currentUser;
    const canManageSettingsAccess = can(currentUser, "manage_settings_access", {}, permissionIndex);
    const permissions = {
      // existing keys
      edit_user_department: can(currentUser, "edit_user_department", {}, permissionIndex),
      view_settings_tab: can(currentUser, "view_settings_shell", {}, permissionIndex),
      view_members_page: can(currentUser, "view_members", {}, permissionIndex),
      view_member_rates: can(currentUser, "view_member_rates", {}, permissionIndex),
      edit_user_rates: can(currentUser, "edit_member_rates", {}, permissionIndex),

      // settings management
      manage_levels: can(currentUser, "manage_levels", {}, permissionIndex),
      manage_departments: can(currentUser, "manage_departments", {}, permissionIndex),
      manage_expense_categories: can(currentUser, "manage_expense_categories", {}, permissionIndex),
      manage_office_locations: can(currentUser, "manage_office_locations", {}, permissionIndex),
      manage_settings_access: canManageSettingsAccess,
      can_delegate: can(currentUser, "can_delegate", {}, permissionIndex),

      // user management
      create_user: can(currentUser, "create_member", {}, permissionIndex),
      edit_user_profile: can(currentUser, "edit_member_profile", {}, permissionIndex),
      reset_user_password: can(currentUser, "admin_reset_password", {}, permissionIndex),
      deactivate_user: can(currentUser, "deactivate_member", {}, permissionIndex),

      // analytics & audit
      view_analytics: can(currentUser, "view_analytics", {}, permissionIndex),
      view_audit_logs: can(currentUser, "view_audit_logs", {}, permissionIndex),

      // projects
      create_project: can(currentUser, "create_project", {}, permissionIndex),
      remove_project: can(currentUser, "archive_project", {}, permissionIndex),

      // clients
      create_client: can(currentUser, "create_client", {}, permissionIndex),
      edit_client: can(currentUser, "edit_client", {}, permissionIndex),
      archive_client: can(currentUser, "archive_client", {}, permissionIndex),

      // assignments
      assign_project_members: can(currentUser, "assign_project_staff", {}, permissionIndex),
      assign_project_managers: can(currentUser, "assign_project_managers", {}, permissionIndex),

      // time entries
      create_entry: can(currentUser, "create_time_entry", {}, permissionIndex),
      approve_entry: can(currentUser, "approve_time", {}, permissionIndex),
      view_entries: can(currentUser, "view_entries", {}, permissionIndex),

      // expenses
      create_expense: can(currentUser, "create_expense", {}, permissionIndex),
      update_expense: can(currentUser, "edit_expense", {}, permissionIndex),
      toggle_expense_status: can(currentUser, "approve_expense", {}, permissionIndex),
      view_expenses: can(currentUser, "view_expenses", {}, permissionIndex),

      // visibility
      view_users: can(currentUser, "view_users", {}, permissionIndex),
      view_clients: can(currentUser, "view_clients", {}, permissionIndex),
      view_projects: can(currentUser, "view_projects", {}, permissionIndex),
    };

    const permissionRoles = canManageSettingsAccess
      ? await sql`
          SELECT key, label, is_active AS "isActive"
          FROM permission_roles
          WHERE is_active = TRUE
          ORDER BY id
        `
      : [];

    return json(200, {
      ...state,
      permissions,
      permissionRoles,
      rolePermissions: canManageSettingsAccess ? permissionRows : [],
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load database state.");
  }
};
