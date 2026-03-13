"use strict";

const {
  clearSession,
  createSession,
  createUserRecord,
  ensureSchema,
  errorResponse,
  findUserByUsername,
  getSessionContext,
  getSql,
  json,
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
    const context = await getSessionContext(sql, event);

    if (request.action === "session") {
      return context.currentUser
        ? json(200, {
            bootstrapRequired: false,
            authenticated: true,
            currentUser: context.currentUser,
          })
        : errorResponse(401, "Not signed in.", {
            bootstrapRequired: context.bootstrapRequired,
            authenticated: false,
          });
    }

    if (request.action === "bootstrap") {
      if (!context.bootstrapRequired) {
        return errorResponse(409, "The admin account has already been created.");
      }

      const user = await createUserRecord(sql, {
        username: request.payload?.username,
        displayName: request.payload?.displayName,
        password: request.payload?.password,
        role: "admin",
      });
      const headers = await createSession(sql, user.id, event);

      return json(
        200,
        {
          bootstrapRequired: false,
          authenticated: true,
          currentUser: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
          },
        },
        headers
      );
    }

    if (request.action === "login") {
      if (context.bootstrapRequired) {
        return errorResponse(409, "Create the admin account first.", {
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

      const headers = await createSession(sql, user.id, event);
      return json(
        200,
        {
          bootstrapRequired: false,
          authenticated: true,
          currentUser: {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            role: user.role,
          },
        },
        headers
      );
    }

    if (request.action === "logout") {
      const headers = await clearSession(sql, event);
      return json(
        200,
        {
          bootstrapRequired: false,
          authenticated: false,
          currentUser: null,
        },
        headers
      );
    }

    return errorResponse(400, "Unknown auth action.");
  } catch (error) {
    return errorResponse(500, error.message || "Authentication failed.");
  }
};
