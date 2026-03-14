"use strict";

const crypto = require("crypto");
const { neon } = require("@netlify/neon");

const DEFAULT_CLIENT_PROJECTS = {
  ISTO: ["Bright Start", "Bright Directions", "ABLE", "Secure Choice"],
};

const SESSION_TTL_DAYS = 14;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

async function getSql() {
  return neon();
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
  await sql`UPDATE users SET role = 'global_admin' WHERE role = 'admin'`;
  await sql`UPDATE users SET role = 'staff' WHERE role = 'member'`;
  await sql`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('global_admin', 'manager', 'staff'))
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx
    ON users (LOWER(username))
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_ci_idx
    ON users (LOWER(display_name))
    WHERE is_active = TRUE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS clients_name_ci_idx
    ON clients (LOWER(name))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS projects_client_name_ci_idx
    ON projects (client_id, LOWER(name))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS manager_clients (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      assigned_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manager_id, client_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS manager_projects (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      assigned_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manager_id, project_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_members (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS entries (
      id UUID PRIMARY KEY,
      user_name TEXT NOT NULL,
      entry_date DATE NOT NULL,
      client_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      task TEXT NOT NULL DEFAULT '',
      hours NUMERIC(10, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    INSERT INTO project_members (project_id, user_id, assigned_by, created_at)
    SELECT DISTINCT
      projects.id,
      users.id,
      users.id,
      NOW()
    FROM entries
    JOIN users ON LOWER(users.display_name) = LOWER(entries.user_name)
    JOIN clients ON LOWER(clients.name) = LOWER(entries.client_name)
    JOIN projects ON projects.client_id = clients.id
      AND LOWER(projects.name) = LOWER(entries.project_name)
    WHERE users.is_active = TRUE
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;

  await seedDefaultCatalog(sql);
  await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
}

async function seedDefaultCatalog(sql) {
  const [{ count }] = await sql`SELECT COUNT(*)::INT AS count FROM clients`;
  if (count > 0) {
    return;
  }

  for (const [clientName, projects] of Object.entries(DEFAULT_CLIENT_PROJECTS)) {
    const inserted = await sql`
      INSERT INTO clients (name)
      VALUES (${clientName})
      RETURNING id
    `;

    const clientId = inserted[0].id;
    for (const projectName of projects) {
      await sql`
        INSERT INTO projects (client_id, name)
        VALUES (${clientId}, ${projectName})
      `;
    }
  }
}

function json(statusCode, body, extraHeaders) {
  const headers = {
    ...JSON_HEADERS,
  };
  const multiValueHeaders = {};

  Object.entries(extraHeaders || {}).forEach(function ([key, value]) {
    if (key.toLowerCase() === "set-cookie") {
      multiValueHeaders["Set-Cookie"] = Array.isArray(value) ? value : [value];
      return;
    }

    headers[key] = value;
  });

  return {
    statusCode,
    headers,
    ...(Object.keys(multiValueHeaders).length ? { multiValueHeaders } : {}),
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, message, extra) {
  return json(statusCode, { error: message, ...(extra || {}) });
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return null;
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value) {
  const role = normalizeText(value);
  if (role === "admin") return "global_admin";
  if (role === "member") return "staff";
  if (role === "global_admin" || role === "manager" || role === "staff") {
    return role;
  }
  return "staff";
}

function isGlobalAdminRole(role) {
  return normalizeRole(role) === "global_admin";
}

function randomId() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, existing] = String(storedHash || "").split(":");
  if (!salt || !existing) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(existing, "hex"), Buffer.from(derived, "hex"));
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1] : "";
}

function getCustomSessionToken(event) {
  return (
    event.headers?.["x-spectra-session"] ||
    event.headers?.["X-Spectra-Session"] ||
    ""
  );
}

function getQuerySessionToken(event) {
  return (
    event.queryStringParameters?.sessionToken ||
    event.multiValueQueryStringParameters?.sessionToken?.[0] ||
    ""
  );
}

function getRequestSessionToken(request) {
  if (!request || typeof request !== "object") {
    return "";
  }

  return String(
    request.sessionToken ||
      request.payload?.sessionToken ||
      ""
  ).trim();
}

function getSessionToken(event, request) {
  return String(
    getRequestSessionToken(request) ||
      getQuerySessionToken(event) ||
      getCustomSessionToken(event) ||
      getBearerToken(event) ||
      ""
  ).trim();
}

async function userCount(sql) {
  const rows = await sql`
    SELECT COUNT(*)::INT AS count
    FROM users
    WHERE is_active = TRUE
  `;
  return rows[0]?.count || 0;
}

async function findUserByUsername(sql, username) {
  const normalized = normalizeText(username);
  if (!normalized) {
    return null;
  }

  const rows = await sql`
    SELECT *
    FROM users
    WHERE LOWER(username) = LOWER(${normalized})
    LIMIT 1
  `;

  return rows[0] || null;
}

async function findUserById(sql, id) {
  const normalized = normalizeText(id);
  if (!normalized) {
    return null;
  }

  const rows = await sql`
    SELECT *
    FROM users
    WHERE id = ${normalized}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function findUserByDisplayName(sql, displayName) {
  const normalized = normalizeText(displayName);
  if (!normalized) {
    return null;
  }

  const rows = await sql`
    SELECT *
    FROM users
    WHERE LOWER(display_name) = LOWER(${normalized})
      AND is_active = TRUE
    LIMIT 1
  `;

  return rows[0] || null;
}

async function listUsers(sql) {
  const rows = await sql`
    SELECT
      id,
      username,
      display_name AS "displayName",
      role,
      is_active AS "isActive",
      created_at AS "createdAt"
    FROM users
    WHERE is_active = TRUE
    ORDER BY LOWER(display_name), LOWER(username)
  `;
  return rows.map((row) => ({ ...row, role: normalizeRole(row.role) }));
}

async function adminCount(sql) {
  const rows = await sql`
    SELECT COUNT(*)::INT AS count
    FROM users
    WHERE is_active = TRUE AND role = 'global_admin'
  `;
  return rows[0]?.count || 0;
}

async function createUserRecord(sql, payload) {
  const username = normalizeText(payload.username);
  const displayName = normalizeText(payload.displayName);
  const password = String(payload.password || "");
  const role = normalizeRole(payload.role);

  if (!username) {
    throw new Error("Username is required.");
  }
  if (!displayName) {
    throw new Error("Display name is required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (await findUserByUsername(sql, username)) {
    throw new Error("That username already exists.");
  }

  const existingDisplayName = await sql`
    SELECT id
    FROM users
    WHERE LOWER(display_name) = LOWER(${displayName})
      AND is_active = TRUE
    LIMIT 1
  `;
  if (existingDisplayName[0]) {
    throw new Error("That team member name already exists.");
  }

  const now = new Date().toISOString();
  const user = {
    id: randomId(),
    username,
    displayName,
    role,
    createdAt: now,
    updatedAt: now,
    passwordHash: hashPassword(password),
  };

  await sql`
    INSERT INTO users (
      id,
      username,
      display_name,
      password_hash,
      role,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      ${user.id},
      ${user.username},
      ${user.displayName},
      ${user.passwordHash},
      ${user.role},
      TRUE,
      ${user.createdAt},
      ${user.updatedAt}
    )
  `;

  return user;
}

async function updateUserRecord(sql, payload, actingUser) {
  const userId = normalizeText(payload.userId);
  const displayName = normalizeText(payload.displayName);
  const username = normalizeText(payload.username);
  const role = normalizeRole(payload.role);
  const existingUser = await findUserById(sql, userId);

  if (!existingUser || !existingUser.is_active) {
    throw new Error("User not found.");
  }
  if (!displayName) {
    throw new Error("Display name is required.");
  }
  if (!username) {
    throw new Error("Username is required.");
  }

  const duplicateUsername = await sql`
    SELECT id
    FROM users
    WHERE LOWER(username) = LOWER(${username})
      AND id <> ${existingUser.id}
    LIMIT 1
  `;
  if (duplicateUsername[0]) {
    throw new Error("That username already exists.");
  }

  const duplicateDisplayName = await sql`
    SELECT id
    FROM users
    WHERE LOWER(display_name) = LOWER(${displayName})
      AND id <> ${existingUser.id}
      AND is_active = TRUE
    LIMIT 1
  `;
  if (duplicateDisplayName[0]) {
    throw new Error("That team member name already exists.");
  }

  if (isGlobalAdminRole(existingUser.role) && !isGlobalAdminRole(role)) {
    const admins = await adminCount(sql);
    if (admins <= 1) {
      throw new Error("At least one Global Admin account is required.");
    }
  }

  const updatedAt = new Date().toISOString();
  await sql`
    UPDATE users
    SET
      username = ${username},
      display_name = ${displayName},
      role = ${role},
      updated_at = ${updatedAt}
    WHERE id = ${existingUser.id}
  `;

  if (existingUser.display_name !== displayName) {
    await sql`
      UPDATE entries
      SET user_name = ${displayName}
      WHERE user_name = ${existingUser.display_name}
    `;
  }

  const refreshed = await findUserById(sql, existingUser.id);
  if (actingUser && actingUser.id === existingUser.id) {
    return {
      id: refreshed.id,
      username: refreshed.username,
      displayName: refreshed.display_name,
      role: refreshed.role,
    };
  }

  return null;
}

async function updateUserPassword(sql, payload) {
  const userId = normalizeText(payload.userId);
  const password = String(payload.password || "");
  const existingUser = await findUserById(sql, userId);

  if (!existingUser || !existingUser.is_active) {
    throw new Error("User not found.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  await sql`
    UPDATE users
    SET
      password_hash = ${hashPassword(password)},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${existingUser.id}
  `;
}

async function deactivateUser(sql, payload, actingUser) {
  const userId = normalizeText(payload.userId);
  const existingUser = await findUserById(sql, userId);

  if (!existingUser || !existingUser.is_active) {
    throw new Error("User not found.");
  }
  if (actingUser && existingUser.id === actingUser.id) {
    throw new Error("You cannot deactivate your own account.");
  }
  if (isGlobalAdminRole(existingUser.role)) {
    const admins = await adminCount(sql);
    if (admins <= 1) {
      throw new Error("At least one Global Admin account is required.");
    }
  }

  await sql`
    UPDATE users
    SET
      is_active = FALSE,
      updated_at = ${new Date().toISOString()}
    WHERE id = ${existingUser.id}
  `;

  await sql`DELETE FROM sessions WHERE user_id = ${existingUser.id}`;
}

async function getSessionContext(sql, event, request) {
  const users = await userCount(sql);
  if (users === 0) {
    return {
      bootstrapRequired: true,
      currentUser: null,
    };
  }

  const token = getSessionToken(event, request);
  if (!token) {
    return {
      bootstrapRequired: false,
      currentUser: null,
    };
  }

  const rows = await sql`
    SELECT
      users.id,
      users.username,
      users.display_name AS "displayName",
      users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > NOW()
      AND users.is_active = TRUE
    LIMIT 1
  `;

  return {
    bootstrapRequired: false,
    currentUser: rows[0]
      ? { ...rows[0], role: normalizeRole(rows[0].role) }
      : null,
  };
}

async function createSession(sql, userId) {
  const token = `${crypto.randomUUID()}${crypto.randomBytes(12).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      ${randomId()},
      ${userId},
      ${hashToken(token)},
      ${expiresAt.toISOString()}
    )
  `;

  return {
    token,
  };
}

async function clearSession(sql, event) {
  const token = getSessionToken(event);
  if (token) {
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }

  return {};
}

function requireAuth(context) {
  return context.currentUser
    ? null
    : errorResponse(401, "Authentication required.", {
        bootstrapRequired: context.bootstrapRequired,
      });
}

function requireAdmin(context) {
  if (!context.currentUser) {
    return requireAuth(context);
  }

  return isGlobalAdminRole(context.currentUser.role)
    ? null
    : errorResponse(403, "Admin access required.");
}

async function findClient(sql, clientName) {
  const normalized = normalizeText(clientName);
  if (!normalized) {
    return null;
  }

  const rows = await sql`
    SELECT id, name
    FROM clients
    WHERE LOWER(name) = LOWER(${normalized})
    LIMIT 1
  `;

  return rows[0] || null;
}

async function findProject(sql, clientName, projectName) {
  const client = await findClient(sql, clientName);
  const normalizedProject = normalizeText(projectName);
  if (!client || !normalizedProject) {
    return null;
  }

  const rows = await sql`
    SELECT projects.id, projects.name, clients.name AS client
    FROM projects
    JOIN clients ON clients.id = projects.client_id
    WHERE projects.client_id = ${client.id}
      AND LOWER(projects.name) = LOWER(${normalizedProject})
    LIMIT 1
  `;

  return rows[0] || null;
}

async function listProjects(sql) {
  return sql`
    SELECT
      projects.id,
      projects.name,
      clients.name AS client,
      projects.created_by AS "createdBy"
    FROM projects
    JOIN clients ON clients.id = projects.client_id
    ORDER BY LOWER(clients.name), LOWER(projects.name)
  `;
}

async function listManagerClientAssignments(sql) {
  return sql`
    SELECT
      manager_clients.manager_id AS "managerId",
      clients.id AS "clientId",
      clients.name AS client
    FROM manager_clients
    JOIN clients ON clients.id = manager_clients.client_id
  `;
}

async function listManagerProjectAssignments(sql) {
  return sql`
    SELECT
      manager_projects.manager_id AS "managerId",
      projects.id AS "projectId",
      projects.name AS project,
      clients.name AS client
    FROM manager_projects
    JOIN projects ON projects.id = manager_projects.project_id
    JOIN clients ON clients.id = projects.client_id
  `;
}

async function listProjectMembers(sql) {
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
    JOIN users ON users.id = project_members.user_id
    WHERE users.is_active = TRUE
  `;
}

async function listManagerAssignmentsForUser(sql, managerId) {
  const clientRows = await sql`
    SELECT
      manager_clients.manager_id AS "managerId",
      clients.id AS "clientId",
      clients.name AS client
    FROM manager_clients
    JOIN clients ON clients.id = manager_clients.client_id
    WHERE manager_clients.manager_id = ${managerId}
  `;
  const projectRows = await sql`
    SELECT
      manager_projects.manager_id AS "managerId",
      projects.id AS "projectId",
      projects.name AS project,
      clients.name AS client
    FROM manager_projects
    JOIN projects ON projects.id = manager_projects.project_id
    JOIN clients ON clients.id = projects.client_id
    WHERE manager_projects.manager_id = ${managerId}
  `;
  return { clientRows, projectRows };
}

async function listProjectMembersForUser(sql, userId) {
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
    JOIN users ON users.id = project_members.user_id
    WHERE project_members.user_id = ${userId}
      AND users.is_active = TRUE
  `;
}

async function listProjectMembersForProjects(sql, projectIds) {
  if (!projectIds || !projectIds.length) {
    return [];
  }
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
    JOIN users ON users.id = project_members.user_id
    WHERE project_members.project_id = ANY(${projectIds})
      AND users.is_active = TRUE
  `;
}

async function getManagerScope(sql, managerId) {
  const clientRows = await sql`
    SELECT client_id
    FROM manager_clients
    WHERE manager_id = ${managerId}
  `;
  const projectRows = await sql`
    SELECT project_id
    FROM manager_projects
    WHERE manager_id = ${managerId}
  `;
  const clientIds = clientRows.map((row) => row.client_id);
  const directProjectIds = projectRows.map((row) => row.project_id);
  const clientProjectRows = clientIds.length
    ? await sql`
        SELECT id
        FROM projects
        WHERE client_id = ANY(${clientIds})
      `
    : [];
  const projectIds = [
    ...new Set([
      ...directProjectIds,
      ...clientProjectRows.map((row) => row.id),
    ]),
  ];
  return { clientIds, projectIds };
}
async function loadState(sql, currentUser) {
  const normalizedUser = currentUser
    ? { ...currentUser, role: normalizeRole(currentUser.role) }
    : null;
  const isGlobalAdmin = normalizedUser && isGlobalAdminRole(normalizedUser.role);
  const isManager = normalizedUser && normalizedUser.role === "manager";

  const catalogRows = await sql`
    SELECT
      clients.name AS client,
      projects.name AS project
    FROM clients
    LEFT JOIN projects ON projects.client_id = clients.id
    ORDER BY LOWER(clients.name), LOWER(projects.name)
  `;

  let entries = [];
  if (isGlobalAdmin) {
    entries = await sql`
      SELECT
        id,
        user_name AS "user",
        TO_CHAR(entry_date, 'YYYY-MM-DD') AS date,
        client_name AS client,
        project_name AS project,
        task,
        hours::FLOAT8 AS hours,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM entries
      ORDER BY entry_date DESC, created_at DESC
    `;
  } else if (isManager) {
    const scope = await getManagerScope(sql, normalizedUser.id);
    if (scope.projectIds.length) {
      entries = await sql`
        SELECT
          entries.id,
          entries.user_name AS "user",
          TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
          entries.client_name AS client,
          entries.project_name AS project,
          entries.task,
          entries.hours::FLOAT8 AS hours,
          entries.notes,
          entries.created_at AS "createdAt",
          entries.updated_at AS "updatedAt"
        FROM entries
        JOIN clients ON LOWER(clients.name) = LOWER(entries.client_name)
        JOIN projects ON projects.client_id = clients.id
          AND LOWER(projects.name) = LOWER(entries.project_name)
        JOIN users ON LOWER(users.display_name) = LOWER(entries.user_name)
        WHERE projects.id = ANY(${scope.projectIds})
          AND (users.role = 'staff' OR users.id = ${normalizedUser.id})
        ORDER BY entries.entry_date DESC, entries.created_at DESC
      `;
    }
  } else if (normalizedUser) {
    entries = await sql`
      SELECT
        id,
        user_name AS "user",
        TO_CHAR(entry_date, 'YYYY-MM-DD') AS date,
        client_name AS client,
        project_name AS project,
        task,
        hours::FLOAT8 AS hours,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM entries
      WHERE user_name = ${normalizedUser.displayName}
      ORDER BY entry_date DESC, created_at DESC
    `;
  }

  const users = isGlobalAdmin || isManager
    ? await listUsers(sql)
    : normalizedUser
      ? [{
          id: normalizedUser.id,
          username: normalizedUser.username,
          displayName: normalizedUser.displayName,
          role: normalizedUser.role,
          isActive: true,
        }]
      : [];

  const projects = await listProjects(sql);
  const assignments = {
    managerClients: [],
    managerProjects: [],
    projectMembers: [],
  };

  if (isGlobalAdmin) {
    assignments.managerClients = await listManagerClientAssignments(sql);
    assignments.managerProjects = await listManagerProjectAssignments(sql);
    assignments.projectMembers = await listProjectMembers(sql);
  } else if (isManager && normalizedUser) {
    const { clientRows, projectRows } = await listManagerAssignmentsForUser(sql, normalizedUser.id);
    assignments.managerClients = clientRows;
    assignments.managerProjects = projectRows;
    const scope = await getManagerScope(sql, normalizedUser.id);
    assignments.projectMembers = await listProjectMembersForProjects(sql, scope.projectIds);
  } else if (normalizedUser) {
    assignments.projectMembers = await listProjectMembersForUser(sql, normalizedUser.id);
  }

  const catalog = {};
  for (const row of catalogRows) {
    if (!catalog[row.client]) {
      catalog[row.client] = [];
    }
    if (row.project) {
      catalog[row.client].push(row.project);
    }
  }

  return {
    bootstrapRequired: false,
    currentUser: normalizedUser,
    users,
    catalog,
    entries,
    projects,
    assignments,
  };
}

module.exports = {
  clearSession,
  createSession,
  createUserRecord,
  deactivateUser,
  ensureSchema,
  errorResponse,
  findClient,
  findProject,
  findUserByDisplayName,
  findUserById,
  findUserByUsername,
  getSessionContext,
  getSql,
  getManagerScope,
  isGlobalAdminRole,
  json,
  listManagerAssignmentsForUser,
  listManagerClientAssignments,
  listManagerProjectAssignments,
  listProjectMembers,
  listProjectMembersForProjects,
  listProjectMembersForUser,
  listProjects,
  listUsers,
  loadState,
  normalizeRole,
  normalizeText,
  parseBody,
  requireAdmin,
  requireAuth,
  updateUserPassword,
  updateUserRecord,
  verifyPassword,
};
