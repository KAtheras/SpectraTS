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
    return json(200, state);
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load database state.");
  }
};
