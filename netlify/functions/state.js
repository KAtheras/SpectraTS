"use strict";

const {
  ensureSchema,
  errorResponse,
  getSessionContext,
  getSql,
  json,
  loadState,
  loadSettingsMetadata,
  listProjectExpenseCategories,
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
    const settingsMetaOnly = String(event.queryStringParameters?.settings_meta || "").trim() === "1";
    if (settingsMetaOnly) {
      const settingsMeta = await loadSettingsMetadata(sql, context.currentUser);
      return json(200, settingsMeta);
    }
    const state = await loadState(sql, context.currentUser);
    state.projectExpenseCategories = await listProjectExpenseCategories(
      sql,
      state?.account?.id || null
    );
    const projectMemberBudgets = await sql`
      SELECT
        project_id AS "projectId",
        user_id AS "userId",
        budget_hours AS "budgetHours",
        budget_amount AS "budgetAmount",
        rate_override AS "rateOverride"
      FROM project_member_budgets
      WHERE account_id = ${state?.account?.id || null}::uuid
      ORDER BY project_id, user_id
    `;
    if (Array.isArray(state.clients)) {
      state.clients = state.clients.map((client) => ({
        ...client,
        isActive: client?.isActive ?? client?.is_active ?? true,
        is_active: client?.isActive ?? client?.is_active ?? true,
        clientLeadId: client?.clientLeadId ?? client?.client_lead_id ?? null,
        client_lead_id: client?.clientLeadId ?? client?.client_lead_id ?? null,
        clientLeadName: client?.clientLeadName ?? null,
      }));
    }
    if (Array.isArray(state.projects)) {
      state.projects = state.projects.map((project) => ({
        ...project,
        isActive: project?.isActive ?? project?.is_active ?? true,
        is_active: project?.isActive ?? project?.is_active ?? true,
        projectLeadId: project?.projectLeadId ?? project?.project_lead_id ?? null,
        project_lead_id: project?.projectLeadId ?? project?.project_lead_id ?? null,
        projectLeadName: project?.projectLeadName ?? null,
        projectDepartmentId: project?.projectDepartmentId ?? project?.project_department_id ?? null,
        project_department_id: project?.projectDepartmentId ?? project?.project_department_id ?? null,
        projectDepartmentName: project?.projectDepartmentName ?? null,
        percentComplete: project?.percentComplete ?? project?.percent_complete ?? null,
        percent_complete: project?.percentComplete ?? project?.percent_complete ?? null,
        percentCompleteUpdatedAt:
          project?.percentCompleteUpdatedAt ?? project?.percent_complete_updated_at ?? null,
        percent_complete_updated_at:
          project?.percentCompleteUpdatedAt ?? project?.percent_complete_updated_at ?? null,
        planningStatus: project?.planningStatus ?? project?.planning_status ?? "draft",
        planning_status: project?.planningStatus ?? project?.planning_status ?? "draft",
      }));
    }
    const currentUser = state.currentUser;
    const canManageSettingsAccess = can(currentUser, "manage_settings_access", {}, permissionIndex);
    const canViewCostRates =
      can(currentUser, "view_cost_rates", {}, permissionIndex) ||
      can(currentUser, "view_cost_rate", {}, permissionIndex);
    const canManageCorporateFunctions = can(
      currentUser,
      "manage_corporate_functions",
      {},
      permissionIndex
    );
    const canManageTargetRealizations = can(
      currentUser,
      "manage_target_realizations",
      {},
      permissionIndex
    );
    const canManageMessagingRules =
      can(currentUser, "manage_messaging_rules", {}, permissionIndex) ||
      can(currentUser, "manage_settings_access", {}, permissionIndex);
    const actorOfficeId = currentUser?.officeId ?? currentUser?.office_id ?? null;
    const globalScopeProbeOfficeId = actorOfficeId
      ? `__outside_office__${String(actorOfficeId)}`
      : "__outside_office__";
    const canSeeAllClientsProjects = can(
      currentUser,
      "see_all_clients_projects",
      { resourceOfficeId: globalScopeProbeOfficeId, actorOfficeId },
      permissionIndex
    );
    const canSeeOfficeClientsProjects = can(
      currentUser,
      "see_office_clients_projects",
      { resourceOfficeId: actorOfficeId, actorOfficeId },
      permissionIndex
    );
    const canSeeAssignedClientsProjects = can(
      currentUser,
      "see_assigned_clients_projects",
      {},
      permissionIndex
    );
    const canManageClientsLifecycle = can(
      currentUser,
      "manage_clients_lifecycle",
      { resourceOfficeId: actorOfficeId, actorOfficeId },
      permissionIndex
    );
    const canManageProjectsLifecycle = can(
      currentUser,
      "manage_projects_lifecycle",
      { resourceOfficeId: actorOfficeId, actorOfficeId },
      permissionIndex
    );
    const canEditClients = can(
      currentUser,
      "edit_clients",
      { resourceOfficeId: actorOfficeId, actorOfficeId },
      permissionIndex
    );
    const canEditProjectsAllModal = can(currentUser, "edit_projects_all_modal", {}, permissionIndex);
    const canEditProjectPlanning = can(currentUser, "edit_project_planning", {}, permissionIndex);
    const canAccessClientsTab = Boolean(
      canSeeAllClientsProjects || canSeeOfficeClientsProjects || canSeeAssignedClientsProjects
    );
    const canViewAllEntries = can(
      currentUser,
      "view_all_entries",
      { resourceOfficeId: globalScopeProbeOfficeId, actorOfficeId },
      permissionIndex
    );
    const canViewOfficeEntries = can(
      currentUser,
      "view_office_entries",
      { resourceOfficeId: actorOfficeId, actorOfficeId },
      permissionIndex
    );
    const canViewAssignedProjectEntries = can(
      currentUser,
      "view_assigned_project_entries",
      { actorOfficeId },
      permissionIndex
    );
    const canViewEntriesByMatrix = Boolean(
      canViewAllEntries || canViewOfficeEntries || canViewAssignedProjectEntries
    );
    const permissions = {
      // existing keys
      edit_user_department: can(currentUser, "edit_user_department", {}, permissionIndex),
      view_settings_tab: false,
      view_members_page: can(currentUser, "view_members", {}, permissionIndex),
      view_member_rates: can(currentUser, "view_member_rates", {}, permissionIndex),
      view_cost_rates: canViewCostRates,
      view_cost_rate: canViewCostRates,
      edit_cost_rates: canViewCostRates,
      edit_user_rates: can(currentUser, "edit_member_rates", {}, permissionIndex),

      // settings management
      manage_departments: can(currentUser, "manage_departments", {}, permissionIndex),
      manage_expense_categories: can(currentUser, "manage_expense_categories", {}, permissionIndex),
      manage_corporate_functions: canManageCorporateFunctions,
      manage_office_locations: can(currentUser, "manage_office_locations", {}, permissionIndex),
      manage_target_realizations: canManageTargetRealizations,
      manage_messaging_rules: canManageMessagingRules,
      can_upload_data: can(currentUser, "can_upload_data", {}, permissionIndex),
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
      manage_projects_lifecycle: canManageProjectsLifecycle,
      edit_projects_all_modal: canEditProjectsAllModal,
      edit_project_planning: canEditProjectPlanning,

      // clients
      create_client: can(currentUser, "create_client", {}, permissionIndex),
      edit_client: can(currentUser, "edit_client", {}, permissionIndex),
      archive_client: can(currentUser, "archive_client", {}, permissionIndex),
      see_all_clients_projects: canSeeAllClientsProjects,
      see_office_clients_projects: canSeeOfficeClientsProjects,
      see_assigned_clients_projects: canSeeAssignedClientsProjects,
      manage_clients_lifecycle: canManageClientsLifecycle,
      edit_clients: canEditClients,

      // assignments
      assign_project_members: can(currentUser, "assign_project_staff", {}, permissionIndex),
      assign_project_managers: can(currentUser, "assign_project_managers", {}, permissionIndex),

      // time entries
      create_entry: can(currentUser, "create_time_entry", {}, permissionIndex),
      approve_entry: can(currentUser, "approve_time", {}, permissionIndex),
      view_entries: canViewEntriesByMatrix || can(currentUser, "view_entries", {}, permissionIndex),

      // expenses
      create_expense: can(currentUser, "create_expense", {}, permissionIndex),
      update_expense: can(currentUser, "edit_expense", {}, permissionIndex),
      toggle_expense_status: can(currentUser, "approve_expense", {}, permissionIndex),
      view_expenses: canViewEntriesByMatrix || can(currentUser, "view_expenses", {}, permissionIndex),

      // visibility
      view_users: can(currentUser, "view_users", {}, permissionIndex),
      view_clients: canAccessClientsTab,
      view_projects: canAccessClientsTab,
    };
    permissions.view_settings_tab = Boolean(
      permissions.view_members_page ||
      permissions.manage_departments ||
      permissions.manage_expense_categories ||
      permissions.manage_corporate_functions ||
      permissions.manage_office_locations ||
      permissions.manage_target_realizations ||
      permissions.manage_messaging_rules ||
      permissions.can_upload_data ||
      permissions.manage_settings_access ||
      permissions.can_delegate
    );

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
      visibleClientIds: Array.isArray(state?.visibleClientIds) ? state.visibleClientIds : [],
      visibleProjectIds: Array.isArray(state?.visibleProjectIds) ? state.visibleProjectIds : [],
      projectMemberBudgets: Array.isArray(projectMemberBudgets) ? projectMemberBudgets : [],
      permissions,
      permissionRoles,
      rolePermissions: canManageSettingsAccess ? permissionRows : [],
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load database state.");
  }
};
