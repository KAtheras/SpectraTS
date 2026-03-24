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
const { can } = require("./permissions");

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

    const state = await loadState(sql, context.currentUser);
    const currentUser = state.currentUser;
    const permissions = {
      // existing keys
      edit_user_department: can(currentUser, "edit_user_department"),
      view_settings_tab: can(currentUser, "view_settings_tab"),
      view_members_page: can(currentUser, "view_members_page"),
      edit_user_rates: can(currentUser, "edit_user_rates"),

      // settings management
      manage_levels: can(currentUser, "manage_levels"),
      manage_departments: can(currentUser, "manage_departments"),
      manage_expense_categories: can(currentUser, "manage_expense_categories"),
      manage_office_locations: can(currentUser, "manage_office_locations"),

      // user management
      create_user: can(currentUser, "create_user"),
      edit_user_profile: can(currentUser, "edit_user_profile"),
      reset_user_password: can(currentUser, "reset_user_password"),
      deactivate_user: can(currentUser, "deactivate_user"),

      // analytics & audit
      view_analytics: can(currentUser, "view_analytics"),
      view_audit_logs: can(currentUser, "view_audit_logs"),

      // projects
      create_project: can(currentUser, "create_project"),
      remove_project: can(currentUser, "remove_project"),

      // clients
      create_client: can(currentUser, "create_client"),
      edit_client: can(currentUser, "edit_client"),
      archive_client: can(currentUser, "archive_client"),

      // assignments
      assign_project_members: can(currentUser, "assign_project_members"),
      assign_project_managers: can(currentUser, "assign_project_managers"),

      // time entries
      create_entry: can(currentUser, "create_entry"),
      approve_entry: can(currentUser, "approve_entry"),
      view_entries: can(currentUser, "view_entries"),

      // expenses
      create_expense: can(currentUser, "create_expense"),
      update_expense: can(currentUser, "update_expense"),
      toggle_expense_status: can(currentUser, "toggle_expense_status"),
      view_expenses: can(currentUser, "view_expenses"),

      // visibility
      view_users: can(currentUser, "view_users"),
      view_clients: can(currentUser, "view_clients"),
      view_projects: can(currentUser, "view_projects"),
    };

    return json(200, { ...state, permissions });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load database state.");
  }
};
