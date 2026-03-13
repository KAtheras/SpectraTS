"use strict";

const DEFAULT_CLIENT_PROJECTS = {
  ISTO: ["Bright Start", "Bright Directions", "ABLE", "Secure Choice"],
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

async function getSql() {
  const { neon } = await import("@netlify/neon");
  return neon();
}

async function ensureSchema(sql) {
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS projects_client_name_ci_idx
    ON projects (client_id, LOWER(name))
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

  await seedDefaultCatalog(sql);
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

async function loadState(sql) {
  const catalogRows = await sql`
    SELECT
      clients.name AS client,
      projects.name AS project
    FROM clients
    LEFT JOIN projects ON projects.client_id = clients.id
    ORDER BY LOWER(clients.name), LOWER(projects.name)
  `;

  const entries = await sql`
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

  const catalog = {};
  for (const row of catalogRows) {
    if (!catalog[row.client]) {
      catalog[row.client] = [];
    }
    if (row.project) {
      catalog[row.client].push(row.project);
    }
  }

  return { catalog, entries };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, message) {
  return json(statusCode, { error: message });
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

module.exports = {
  ensureSchema,
  errorResponse,
  findClient,
  findProject,
  getSql,
  json,
  loadState,
  parseBody,
  normalizeText,
};
