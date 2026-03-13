"use strict";

const {
  ensureSchema,
  errorResponse,
  findClient,
  findProject,
  getSql,
  json,
  loadState,
  normalizeText,
  parseBody,
} = require("./_db");

function normalizeHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : NaN;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return "Entry payload is required.";
  }
  if (!normalizeText(entry.id)) {
    return "Entry id is required.";
  }
  if (!normalizeText(entry.user)) {
    return "Team member is required.";
  }
  if (!normalizeText(entry.date)) {
    return "Date is required.";
  }
  if (!normalizeText(entry.client)) {
    return "Client is required.";
  }
  if (!normalizeText(entry.project)) {
    return "Project is required.";
  }

  const hours = normalizeHours(entry.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return "Hours must be between 0 and 24.";
  }

  return "";
}

async function addClient(sql, payload) {
  const clientName = normalizeText(payload.clientName);
  if (!clientName) {
    return errorResponse(400, "Client name is required.");
  }

  if (await findClient(sql, clientName)) {
    return errorResponse(409, "That client already exists.");
  }

  await sql`INSERT INTO clients (name) VALUES (${clientName})`;
  return null;
}

async function addProject(sql, payload) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!clientName) {
    return errorResponse(400, "Select a client first.");
  }
  if (!projectName) {
    return errorResponse(400, "Project name is required.");
  }

  const client = await findClient(sql, clientName);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  if (await findProject(sql, clientName, projectName)) {
    return errorResponse(409, "That project already exists for this client.");
  }

  await sql`
    INSERT INTO projects (client_id, name)
    VALUES (${client.id}, ${projectName})
  `;

  return null;
}

async function renameClient(sql, payload) {
  const clientName = normalizeText(payload.clientName);
  const nextName = normalizeText(payload.nextName);
  if (!clientName) {
    return errorResponse(404, "Client not found.");
  }
  if (!nextName) {
    return errorResponse(400, "Client name is required.");
  }

  const client = await findClient(sql, clientName);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }
  if (client.name.toLowerCase() === nextName.toLowerCase()) {
    return null;
  }
  if (await findClient(sql, nextName)) {
    return errorResponse(409, "That client already exists.");
  }

  await sql`UPDATE clients SET name = ${nextName} WHERE id = ${client.id}`;
  await sql`
    UPDATE entries
    SET client_name = ${nextName}
    WHERE LOWER(client_name) = LOWER(${client.name})
  `;

  return null;
}

async function renameProject(sql, payload) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const nextName = normalizeText(payload.nextName);
  if (!clientName || !projectName) {
    return errorResponse(404, "Project not found.");
  }
  if (!nextName) {
    return errorResponse(400, "Project name is required.");
  }

  const project = await findProject(sql, clientName, projectName);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }
  if (project.name.toLowerCase() === nextName.toLowerCase()) {
    return null;
  }
  if (await findProject(sql, clientName, nextName)) {
    return errorResponse(409, "That project already exists for this client.");
  }

  await sql`UPDATE projects SET name = ${nextName} WHERE id = ${project.id}`;
  await sql`
    UPDATE entries
    SET project_name = ${nextName}
    WHERE LOWER(client_name) = LOWER(${clientName})
      AND LOWER(project_name) = LOWER(${project.name})
  `;

  return null;
}

async function removeClient(sql, payload) {
  const clientName = normalizeText(payload.clientName);
  const client = await findClient(sql, clientName);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  const rows = await sql`
    SELECT COALESCE(SUM(hours)::FLOAT8, 0) AS total
    FROM entries
    WHERE LOWER(client_name) = LOWER(${client.name})
  `;
  const hoursLogged = rows[0]?.total || 0;

  await sql`DELETE FROM clients WHERE id = ${client.id}`;

  return hoursLogged > 0
    ? { message: `Client removed from active catalog. ${hoursLogged.toFixed(2)} logged hours were kept in history.` }
    : { message: "" };
}

async function removeProject(sql, payload) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const project = await findProject(sql, clientName, projectName);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const rows = await sql`
    SELECT COALESCE(SUM(hours)::FLOAT8, 0) AS total
    FROM entries
    WHERE LOWER(client_name) = LOWER(${clientName})
      AND LOWER(project_name) = LOWER(${project.name})
  `;
  const hoursLogged = rows[0]?.total || 0;

  await sql`DELETE FROM projects WHERE id = ${project.id}`;

  return hoursLogged > 0
    ? { message: `Project removed from active catalog. ${hoursLogged.toFixed(2)} logged hours were kept in history.` }
    : { message: "" };
}

async function saveEntry(sql, payload) {
  const entry = payload.entry;
  const validationError = validateEntry(entry);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  await sql`
    INSERT INTO entries (
      id,
      user_name,
      entry_date,
      client_name,
      project_name,
      task,
      hours,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      ${normalizeText(entry.id)},
      ${normalizeText(entry.user)},
      ${normalizeText(entry.date)},
      ${normalizeText(entry.client)},
      ${normalizeText(entry.project)},
      ${normalizeText(entry.task)},
      ${normalizeHours(entry.hours)},
      ${normalizeText(entry.notes)},
      ${normalizeText(entry.createdAt)},
      ${normalizeText(entry.updatedAt)}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      entry_date = EXCLUDED.entry_date,
      client_name = EXCLUDED.client_name,
      project_name = EXCLUDED.project_name,
      task = EXCLUDED.task,
      hours = EXCLUDED.hours,
      notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;

  return null;
}

async function deleteEntry(sql, payload) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Entry id is required.");
  }

  await sql`DELETE FROM entries WHERE id = ${id}`;
  return null;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  const request = parseBody(event);
  if (!request || !normalizeText(request.action)) {
    return errorResponse(400, "Invalid mutation payload.");
  }

  try {
    const sql = await getSql();
    await ensureSchema(sql);

    let mutationResult = null;
    switch (request.action) {
      case "add_client":
        mutationResult = await addClient(sql, request.payload || {});
        break;
      case "add_project":
        mutationResult = await addProject(sql, request.payload || {});
        break;
      case "rename_client":
        mutationResult = await renameClient(sql, request.payload || {});
        break;
      case "rename_project":
        mutationResult = await renameProject(sql, request.payload || {});
        break;
      case "remove_client":
        mutationResult = await removeClient(sql, request.payload || {});
        break;
      case "remove_project":
        mutationResult = await removeProject(sql, request.payload || {});
        break;
      case "save_entry":
        mutationResult = await saveEntry(sql, request.payload || {});
        break;
      case "delete_entry":
        mutationResult = await deleteEntry(sql, request.payload || {});
        break;
      default:
        return errorResponse(400, "Unknown mutation action.");
    }

    if (mutationResult && mutationResult.statusCode) {
      return mutationResult;
    }

    const state = await loadState(sql);
    return json(200, {
      ...state,
      message: mutationResult?.message || "",
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to apply database mutation.");
  }
};
