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
      edit_user_department: can(currentUser, "edit_user_department"),
      view_settings_tab: can(currentUser, "view_settings_tab"),
      view_members_page: can(currentUser, "view_members_page"),
      edit_user_rates: can(currentUser, "edit_user_rates"),
    };

    return json(200, { ...state, permissions });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load database state.");
  }
};
