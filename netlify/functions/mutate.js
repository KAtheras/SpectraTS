"use strict";

const {
  createUserRecord,
  deactivateUser,
  ensureSchema,
  errorResponse,
  findClient,
  findProject,
  findUserByDisplayName,
  findUserById,
  getSessionContext,
  getSql,
  getManagerScope,
  isGlobalAdminRole,
  json,
  loadState,
  normalizeRole,
  normalizeText,
  parseBody,
  requireAdmin,
  requireAuth,
  updateUserPassword,
  updateUserRecord,
} = require("./_db");

function normalizeHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : NaN;
}

function isGlobalAdmin(user) {
  return user && isGlobalAdminRole(user.role);
}

function isManager(user) {
  return user && user.role === "manager";
}

function isStaff(user) {
  return user && user.role === "staff";
}

function validateEntry(entry, currentUser) {
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

async function addProject(sql, payload, currentUser) {
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
    INSERT INTO projects (client_id, name, created_by)
    VALUES (${client.id}, ${projectName}, ${currentUser?.id || null})
  `;

  return null;
}

async function managerHasClient(sql, managerId, clientId) {
  const rows = await sql`
    SELECT id
    FROM manager_clients
    WHERE manager_id = ${managerId}
      AND client_id = ${clientId}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

async function managerHasProjectAccess(sql, managerId, projectId) {
  const scope = await getManagerScope(sql, managerId);
  return scope.projectIds.includes(projectId);
}

async function assignManagerToClient(sql, payload, currentUser) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  if (!managerId || !clientName) {
    return errorResponse(400, "Manager and client are required.");
  }

  const manager = await findUserById(sql, managerId);
  if (!manager || normalizeRole(manager.role) !== "manager") {
    return errorResponse(404, "Manager not found.");
  }

  const client = await findClient(sql, clientName);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  await sql`
    INSERT INTO manager_clients (manager_id, client_id, assigned_by)
    VALUES (${managerId}, ${client.id}, ${currentUser?.id || null})
    ON CONFLICT (manager_id, client_id) DO NOTHING
  `;
  return null;
}

async function unassignManagerFromClient(sql, payload) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  if (!managerId || !clientName) {
    return errorResponse(400, "Manager and client are required.");
  }

  const client = await findClient(sql, clientName);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  await sql`
    DELETE FROM manager_clients
    WHERE manager_id = ${managerId}
      AND client_id = ${client.id}
  `;
  return null;
}

async function assignManagerToProject(sql, payload, currentUser) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!managerId || !clientName || !projectName) {
    return errorResponse(400, "Manager and project are required.");
  }

  const manager = await findUserById(sql, managerId);
  if (!manager || normalizeRole(manager.role) !== "manager") {
    return errorResponse(404, "Manager not found.");
  }

  const project = await findProject(sql, clientName, projectName);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  await sql`
    INSERT INTO manager_projects (manager_id, project_id, assigned_by)
    VALUES (${managerId}, ${project.id}, ${currentUser?.id || null})
    ON CONFLICT (manager_id, project_id) DO NOTHING
  `;
  return null;
}

async function unassignManagerFromProject(sql, payload) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!managerId || !clientName || !projectName) {
    return errorResponse(400, "Manager and project are required.");
  }

  const project = await findProject(sql, clientName, projectName);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  await sql`
    DELETE FROM manager_projects
    WHERE manager_id = ${managerId}
      AND project_id = ${project.id}
  `;
  return null;
}

async function addProjectMember(sql, payload, currentUser) {
  const userId = normalizeText(payload.userId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!userId || !clientName || !projectName) {
    return errorResponse(400, "Member and project are required.");
  }

  const user = await findUserById(sql, userId);
  if (!user || normalizeRole(user.role) !== "staff") {
    return errorResponse(404, "Staff member not found.");
  }

  const project = await findProject(sql, clientName, projectName);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  await sql`
    INSERT INTO project_members (project_id, user_id, assigned_by)
    VALUES (${project.id}, ${userId}, ${currentUser.id})
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;
  return null;
}

async function removeProjectMember(sql, payload, currentUser) {
  const userId = normalizeText(payload.userId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!userId || !clientName || !projectName) {
    return errorResponse(400, "Member and project are required.");
  }

  const project = await findProject(sql, clientName, projectName);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  await sql`
    DELETE FROM project_members
    WHERE project_id = ${project.id}
      AND user_id = ${userId}
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

async function saveEntry(sql, payload, currentUser) {
  const entry = payload.entry;
  const validationError = validateEntry(entry, currentUser);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const project = await findProject(sql, entry.client, entry.project);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const targetUser = await findUserByDisplayName(sql, entry.user);
  if (!targetUser) {
    return errorResponse(404, "Team member not found.");
  }
  const targetRole = normalizeRole(targetUser.role);

  if (isGlobalAdmin(currentUser)) {
    // Full access.
  } else if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
    if (targetUser.id !== currentUser.id && targetRole !== "staff") {
      return errorResponse(403, "Managers can only edit staff time.");
    }
  } else if (isStaff(currentUser)) {
    if (targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save entries for your own account.");
    }
    const memberRows = await sql`
      SELECT id
      FROM project_members
      WHERE project_id = ${project.id}
        AND user_id = ${currentUser.id}
      LIMIT 1
    `;
    if (!memberRows[0]) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  if (targetRole === "staff") {
    const memberRows = await sql`
      SELECT id
      FROM project_members
      WHERE project_id = ${project.id}
        AND user_id = ${targetUser.id}
      LIMIT 1
    `;
    if (!memberRows[0]) {
      return errorResponse(403, "Staff member is not assigned to this project.");
    }
  }

  if (!isGlobalAdmin(currentUser)) {
    const rows = await sql`
      SELECT user_name
      FROM entries
      WHERE id = ${normalizeText(entry.id)}
      LIMIT 1
    `;
    if (rows[0] && rows[0].user_name !== entry.user && isStaff(currentUser)) {
      return errorResponse(403, "You can only update your own entries.");
    }
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

async function deleteEntry(sql, payload, currentUser) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Entry id is required.");
  }

  const rows = await sql`
    SELECT
      id,
      user_name AS "user",
      client_name AS client,
      project_name AS project
    FROM entries
    WHERE id = ${id}
    LIMIT 1
  `;
  const entry = rows[0];
  if (!entry) {
    return errorResponse(404, "Entry not found.");
  }

  const project = await findProject(sql, entry.client, entry.project);
  if (!project && !isGlobalAdmin(currentUser)) {
    return errorResponse(403, "You are not assigned to this project.");
  }

  if (isGlobalAdmin(currentUser)) {
    // Full access.
  } else if (isManager(currentUser)) {
    if (project) {
      const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id);
      if (!hasAccess) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    }
    const targetUser = await findUserByDisplayName(sql, entry.user);
    const targetRole = targetUser ? normalizeRole(targetUser.role) : "";
    if (targetUser && targetUser.id !== currentUser.id && targetRole !== "staff") {
      return errorResponse(403, "Managers can only edit staff time.");
    }
  } else if (isStaff(currentUser)) {
    if (entry.user !== currentUser.displayName) {
      return errorResponse(403, "You can only delete your own entries.");
    }
    if (project) {
      const memberRows = await sql`
        SELECT id
        FROM project_members
        WHERE project_id = ${project.id}
          AND user_id = ${currentUser.id}
        LIMIT 1
      `;
      if (!memberRows[0]) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    }
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
    const context = await getSessionContext(sql, event, request);
    const authError = requireAuth(context);
    if (authError) {
      return authError;
    }

    let mutationResult = null;

    switch (request.action) {
      case "add_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await addClient(sql, request.payload || {});
        break;
      }
      case "add_project": {
        if (isGlobalAdmin(context.currentUser)) {
          mutationResult = await addProject(sql, request.payload || {}, context.currentUser);
          break;
        }
        if (!isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const client = await findClient(sql, clientName);
        if (!client) {
          return errorResponse(404, "Client not found.");
        }
        const hasClientAccess = await managerHasClient(sql, context.currentUser.id, client.id);
        if (!hasClientAccess) {
          return errorResponse(403, "You are not assigned to this client.");
        }
        mutationResult = await addProject(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "rename_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await renameClient(sql, request.payload || {});
        break;
      }
      case "rename_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await renameProject(sql, request.payload || {});
        break;
      }
      case "remove_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await removeClient(sql, request.payload || {});
        break;
      }
      case "remove_project": {
        if (isGlobalAdmin(context.currentUser)) {
          mutationResult = await removeProject(sql, request.payload || {});
          break;
        }
        if (!isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        const project = await findProject(sql, clientName, projectName);
        if (!project) {
          return errorResponse(404, "Project not found.");
        }
        const projectRow = await sql`
          SELECT created_by
          FROM projects
          WHERE id = ${project.id}
          LIMIT 1
        `;
        const createdBy = projectRow[0]?.created_by || "";
        if (createdBy !== context.currentUser.id) {
          return errorResponse(403, "You can only remove projects you created.");
        }
        mutationResult = await removeProject(sql, request.payload || {});
        break;
      }
      case "save_entry":
        mutationResult = await saveEntry(sql, request.payload || {}, context.currentUser);
        break;
      case "delete_entry":
        mutationResult = await deleteEntry(sql, request.payload || {}, context.currentUser);
        break;
      case "assign_manager_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await assignManagerToClient(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "unassign_manager_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await unassignManagerFromClient(sql, request.payload || {});
        break;
      }
      case "assign_manager_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await assignManagerToProject(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "unassign_manager_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await unassignManagerFromProject(sql, request.payload || {});
        break;
      }
      case "add_project_member": {
        if (!isGlobalAdmin(context.currentUser) && !isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        mutationResult = await addProjectMember(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "remove_project_member": {
        if (!isGlobalAdmin(context.currentUser) && !isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        mutationResult = await removeProjectMember(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "add_user": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        await createUserRecord(sql, request.payload || {});
        break;
      }
      case "update_user": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const maybeCurrentUser = await updateUserRecord(sql, request.payload || {}, context.currentUser);
        if (maybeCurrentUser) {
          context.currentUser = maybeCurrentUser;
        }
        break;
      }
      case "reset_user_password": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        await updateUserPassword(sql, request.payload || {});
        break;
      }
      case "deactivate_user": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        await deactivateUser(sql, request.payload || {}, context.currentUser);
        break;
      }
      default:
        return errorResponse(400, "Unknown mutation action.");
    }

    if (mutationResult && mutationResult.statusCode) {
      return mutationResult;
    }

    const state = await loadState(sql, context.currentUser);
    return json(200, {
      ...state,
      message: mutationResult?.message || "",
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to apply database mutation.");
  }
};
