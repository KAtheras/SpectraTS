"use strict";

const {
  clearSession,
  createSession,
  createUserRecord,
  ensureDefaultAccount,
  ensureSchema,
  errorResponse,
  findUserByUsername,
  getSessionContext,
  getSql,
  json,
  loadState,
  normalizeText,
  parseBody,
  verifyPassword,
} = require("./_db");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  const request = parseBody(event);
  if (!request || !normalizeText(request.action)) {
    return errorResponse(400, "Invalid auth request.");
  }

  try {
    const sql = await getSql();
    await ensureSchema(sql);
    const context = await getSessionContext(sql, event, request);

    if (request.action === "session") {
      if (!context.currentUser) {
        return errorResponse(401, "Not signed in.", {
          bootstrapRequired: context.bootstrapRequired,
          authenticated: false,
        });
      }

      const state = await loadState(sql, context.currentUser);
      return json(200, {
        ...state,
        authenticated: true,
      });
    }

    if (request.action === "bootstrap") {
      if (!context.bootstrapRequired) {
        return errorResponse(409, "The Admin account has already been created.");
      }

      const accountId = await ensureDefaultAccount(sql);
      const user = await createUserRecord(sql, {
        username: request.payload?.username,
        displayName: request.payload?.displayName,
        password: request.payload?.password,
        level: 6,
        mustChangePassword: false,
        accountId,
      });
      const session = await createSession(sql, user.id);

      const state = await loadState(sql, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        level: user.level,
        baseRate: user.baseRate ?? user.base_rate ?? null,
        costRate: user.costRate ?? user.cost_rate ?? null,
        mustChangePassword: user.mustChangePassword ?? user.must_change_password ?? false,
        accountId,
      });

      return json(200, {
        ...state,
        authenticated: true,
        sessionToken: session.token,
      });
    }

    if (request.action === "login") {
      if (context.bootstrapRequired) {
        return errorResponse(409, "Create the Admin account first.", {
          bootstrapRequired: true,
        });
      }

      const username = request.payload?.username;
      const password = String(request.payload?.password || "");
      const user = await findUserByUsername(sql, username);

      if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
        return errorResponse(401, "Invalid username or password.", {
          bootstrapRequired: false,
        });
      }

      const session = await createSession(sql, user.id);
      const state = await loadState(sql, {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        level: user.level,
        baseRate: user.base_rate ?? null,
        costRate: user.cost_rate ?? null,
        mustChangePassword: user.must_change_password ?? false,
        accountId: user.account_id,
      });

      return json(200, {
        ...state,
        authenticated: true,
        sessionToken: session.token,
      });
    }

    if (request.action === "logout") {
      await clearSession(sql, event);
      return json(
        200,
        {
          bootstrapRequired: false,
          authenticated: false,
          currentUser: null,
        },
        undefined
      );
    }

    return errorResponse(400, "Unknown auth action.");
  } catch (error) {
    return errorResponse(500, error.message || "Authentication failed.");
  }
};
