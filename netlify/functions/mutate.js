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
  json,
  loadState,
  normalizeLevel,
  normalizeText,
  parseBody,
  requireAdmin,
  requireSuperAdmin,
  requireAuth,
  updateUserPassword,
  updateUserRecord,
} = require("./_db");

function normalizeHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : NaN;
}

function isGlobalAdmin(user) {
  return user && user.level >= 6;
}

function isManager(user) {
  return user && user.level >= 3 && user.level <= 4;
}

function isStaff(user) {
  return user && user.level <= 2;
}

function isAdmin(user) {
  return user && user.level >= 5;
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase() === "approved"
    ? "approved"
    : "pending";
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

async function updateLevelLabels(sql, payload, accountId) {
  const labels = payload?.labels;
  if (!labels || typeof labels !== "object") {
    return errorResponse(400, "Level labels are required.");
  }

  const updates = [];
  for (let level = 1; level <= 6; level += 1) {
    const label = normalizeText(labels[level]);
    if (!label) {
      return errorResponse(400, "Each level needs a label.");
    }
    updates.push({ level, label });
  }

  for (const item of updates) {
    await sql`
      INSERT INTO level_labels (account_id, level, label, updated_at)
      VALUES (${accountId}::uuid, ${item.level}, ${item.label}, ${new Date().toISOString()})
      ON CONFLICT (account_id, level) DO UPDATE SET
        label = EXCLUDED.label,
        updated_at = EXCLUDED.updated_at
    `;
  }

  return null;
}
async function addClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  if (!clientName) {
    return errorResponse(400, "Client name is required.");
  }

  if (await findClient(sql, clientName, accountId)) {
    return errorResponse(409, "That client already exists.");
  }

  await sql`
    INSERT INTO clients (account_id, name)
    VALUES (${accountId}::uuid, ${clientName})
  `;
  return null;
}

async function addProject(sql, payload, currentUser, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!clientName) {
    return errorResponse(400, "Select a client first.");
  }
  if (!projectName) {
    return errorResponse(400, "Project name is required.");
  }

  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  if (await findProject(sql, clientName, projectName, accountId)) {
    return errorResponse(409, "That project already exists for this client.");
  }

  await sql`
    INSERT INTO projects (client_id, account_id, name, created_by)
    VALUES (${client.id}, ${accountId}::uuid, ${projectName}, ${currentUser?.id || null})
  `;

  return null;
}

async function managerHasClient(sql, managerId, clientId, accountId) {
  const rows = await sql`
    SELECT id
    FROM manager_clients
    WHERE manager_id = ${managerId}
      AND client_id = ${clientId}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

async function managerHasProjectAccess(sql, managerId, projectId, accountId) {
  const scope = await getManagerScope(sql, managerId, accountId);
  return scope.projectIds.includes(projectId);
}

async function assignManagerToClient(sql, payload, currentUser, accountId) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  if (!managerId || !clientName) {
    return errorResponse(400, "Manager and client are required.");
  }

  const manager = await findUserById(sql, managerId, accountId);
  if (!manager || normalizeLevel(manager.level) < 3) {
    return errorResponse(404, "Manager not found.");
  }

  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  await sql`
    INSERT INTO manager_clients (manager_id, client_id, account_id, assigned_by)
    VALUES (${managerId}, ${client.id}, ${accountId}::uuid, ${currentUser?.id || null})
    ON CONFLICT (manager_id, client_id) DO NOTHING
  `;
  return null;
}

async function unassignManagerFromClient(sql, payload, accountId) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  if (!managerId || !clientName) {
    return errorResponse(400, "Manager and client are required.");
  }

  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  await sql`
    DELETE FROM manager_clients
    WHERE manager_id = ${managerId}
      AND client_id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;
  return null;
}

async function assignManagerToProject(sql, payload, currentUser, accountId) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const override =
    payload.chargeRateOverride !== undefined && payload.chargeRateOverride !== null && payload.chargeRateOverride !== ""
      ? Number(payload.chargeRateOverride)
      : null;
  if (!managerId || !clientName || !projectName) {
    return errorResponse(400, "Manager and project are required.");
  }
  if (override !== null && !(Number.isFinite(override) && override >= 0)) {
    return errorResponse(400, "Override rate must be non-negative.");
  }

  const manager = await findUserById(sql, managerId, accountId);
  if (!manager || normalizeLevel(manager.level) < 3) {
    return errorResponse(404, "Manager not found.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  await sql`
    INSERT INTO manager_projects (manager_id, project_id, account_id, assigned_by, charge_rate_override)
    VALUES (${managerId}, ${project.id}, ${accountId}::uuid, ${currentUser?.id || null}, ${override})
    ON CONFLICT (manager_id, project_id) DO UPDATE SET
      charge_rate_override = EXCLUDED.charge_rate_override
  `;
  return null;
}

async function unassignManagerFromProject(sql, payload, accountId) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!managerId || !clientName || !projectName) {
    return errorResponse(400, "Manager and project are required.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  await sql`
    DELETE FROM manager_projects
    WHERE manager_id = ${managerId}
      AND project_id = ${project.id}
      AND account_id = ${accountId}::uuid
  `;
  return null;
}

async function addProjectMember(sql, payload, currentUser, accountId) {
  const userId = normalizeText(payload.userId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const override =
    payload.chargeRateOverride !== undefined && payload.chargeRateOverride !== null && payload.chargeRateOverride !== ""
      ? Number(payload.chargeRateOverride)
      : null;
  if (!userId || !clientName || !projectName) {
    return errorResponse(400, "Member and project are required.");
  }
  if (override !== null && !(Number.isFinite(override) && override >= 0)) {
    return errorResponse(400, "Override rate must be non-negative.");
  }

  const user = await findUserById(sql, userId, accountId);
  if (!user || normalizeLevel(user.level) > 2) {
    return errorResponse(404, "Staff member not found.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(
      sql,
      currentUser.id,
      project.id,
      accountId
    );
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  await sql`
    INSERT INTO project_members (project_id, user_id, account_id, assigned_by, charge_rate_override)
    VALUES (${project.id}, ${userId}, ${accountId}::uuid, ${currentUser.id}, ${override})
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      charge_rate_override = EXCLUDED.charge_rate_override
  `;
  if (override !== null) {
    await sql`
      UPDATE project_members
      SET charge_rate_override = ${override}
      WHERE project_id = ${project.id}
        AND user_id = ${userId}
        AND account_id = ${accountId}::uuid
    `;
  }
  return null;
}

async function removeProjectMember(sql, payload, currentUser, accountId) {
  const userId = normalizeText(payload.userId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  if (!userId || !clientName || !projectName) {
    return errorResponse(400, "Member and project are required.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(
      sql,
      currentUser.id,
      project.id,
      accountId
    );
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  await sql`
    DELETE FROM project_members
    WHERE project_id = ${project.id}
      AND user_id = ${userId}
      AND account_id = ${accountId}::uuid
  `;
  return null;
}

async function updateProjectMemberRate(sql, payload, currentUser, accountId) {
  const userId = normalizeText(payload.userId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const overrideRaw = payload.chargeRateOverride;
  const override =
    overrideRaw === null || overrideRaw === "" || overrideRaw === undefined
      ? null
      : Number(overrideRaw);

  if (!userId || !clientName || !projectName) {
    return errorResponse(400, "Member and project are required.");
  }
  if (override !== null && !(Number.isFinite(override) && override >= 0)) {
    return errorResponse(400, "Override must be a non-negative number.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  } else if (!isAdmin(currentUser)) {
    return errorResponse(403, "Manager access required.");
  }

  await sql`
    UPDATE project_members
    SET charge_rate_override = ${override}
    WHERE project_id = ${project.id}
      AND user_id = ${userId}
      AND account_id = ${accountId}::uuid
  `;

  return null;
}

async function updateManagerProjectRate(sql, payload, currentUser, accountId) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const overrideRaw = payload.chargeRateOverride;
  const override =
    overrideRaw === null || overrideRaw === "" || overrideRaw === undefined
      ? null
      : Number(overrideRaw);

  if (!managerId || !clientName || !projectName) {
    return errorResponse(400, "Manager and project are required.");
  }
  if (override !== null && !(Number.isFinite(override) && override >= 0)) {
    return errorResponse(400, "Override must be a non-negative number.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  } else if (!isAdmin(currentUser)) {
    return errorResponse(403, "Manager access required.");
  }

  await sql`
    UPDATE manager_projects
    SET charge_rate_override = ${override}
    WHERE project_id = ${project.id}
      AND manager_id = ${managerId}
      AND account_id = ${accountId}::uuid
  `;

  return null;
}

async function renameClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const nextName = normalizeText(payload.nextName);
  if (!clientName) {
    return errorResponse(404, "Client not found.");
  }
  if (!nextName) {
    return errorResponse(400, "Client name is required.");
  }

  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }
  if (client.name.toLowerCase() === nextName.toLowerCase()) {
    return null;
  }
  if (await findClient(sql, nextName, accountId)) {
    return errorResponse(409, "That client already exists.");
  }

  await sql`UPDATE clients SET name = ${nextName} WHERE id = ${client.id}`;
  await sql`
    UPDATE entries
    SET client_name = ${nextName}
    WHERE LOWER(client_name) = LOWER(${client.name})
      AND account_id = ${accountId}::uuid
  `;

  return null;
}

async function renameProject(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const nextName = normalizeText(payload.nextName);
  if (!clientName || !projectName) {
    return errorResponse(404, "Project not found.");
  }
  if (!nextName) {
    return errorResponse(400, "Project name is required.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }
  if (project.name.toLowerCase() === nextName.toLowerCase()) {
    return null;
  }
  if (await findProject(sql, clientName, nextName, accountId)) {
    return errorResponse(409, "That project already exists for this client.");
  }

  await sql`UPDATE projects SET name = ${nextName} WHERE id = ${project.id}`;
  await sql`
    UPDATE entries
    SET project_name = ${nextName}
    WHERE LOWER(client_name) = LOWER(${clientName})
      AND LOWER(project_name) = LOWER(${project.name})
      AND account_id = ${accountId}::uuid
  `;

  return null;
}

async function removeClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  const rows = await sql`
    SELECT COALESCE(SUM(hours)::FLOAT8, 0) AS total
    FROM entries
    WHERE LOWER(client_name) = LOWER(${client.name})
      AND account_id = ${accountId}::uuid
  `;
  const hoursLogged = rows[0]?.total || 0;

  await sql`DELETE FROM clients WHERE id = ${client.id}`;

  return hoursLogged > 0
    ? { message: `Client removed from active catalog. ${hoursLogged.toFixed(2)} logged hours were kept in history.` }
    : { message: "" };
}

async function removeProject(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const rows = await sql`
    SELECT COALESCE(SUM(hours)::FLOAT8, 0) AS total
    FROM entries
    WHERE LOWER(client_name) = LOWER(${clientName})
      AND LOWER(project_name) = LOWER(${project.name})
      AND account_id = ${accountId}::uuid
  `;
  const hoursLogged = rows[0]?.total || 0;

  await sql`DELETE FROM projects WHERE id = ${project.id}`;

  return hoursLogged > 0
    ? { message: `Project removed from active catalog. ${hoursLogged.toFixed(2)} logged hours were kept in history.` }
    : { message: "" };
}

async function saveEntry(sql, payload, currentUser, accountId) {
  const entry = payload.entry;
  const validationError = validateEntry(entry, currentUser);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const project = await findProject(sql, entry.client, entry.project, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const targetUser = await findUserByDisplayName(sql, entry.user, accountId);
  if (!targetUser) {
    return errorResponse(404, "Team member not found.");
  }
  const targetLevel = normalizeLevel(targetUser.level);

  if (isAdmin(currentUser)) {
    // Full access.
  } else if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(
      sql,
      currentUser.id,
      project.id,
      accountId
    );
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
    if (targetUser.id !== currentUser.id && targetLevel > 2) {
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

  if (targetLevel <= 2) {
    const memberRows = await sql`
      SELECT id
      FROM project_members
      WHERE project_id = ${project.id}
        AND user_id = ${targetUser.id}
        AND account_id = ${accountId}::uuid
      LIMIT 1
    `;
    if (!memberRows[0]) {
      return errorResponse(403, "Staff member is not assigned to this project.");
    }
  }

  if (!isAdmin(currentUser)) {
    const rows = await sql`
      SELECT user_name
      FROM entries
      WHERE id = ${normalizeText(entry.id)}
        AND account_id = ${accountId}::uuid
      LIMIT 1
    `;
    if (rows[0] && rows[0].user_name !== entry.user && isStaff(currentUser)) {
      return errorResponse(403, "You can only update your own entries.");
    }
  }

  const existingRows = await sql`
    SELECT
      status,
      user_name,
      entry_date,
      client_name,
      project_name,
      task,
      hours,
      notes,
      approved_at,
      approved_by_user_id
    FROM entries
    WHERE id = ${normalizeText(entry.id)}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const existing = existingRows[0];
  const persistedStatus = existing?.status;

  const hasContentChanges = existing
    ? !(
        existing.user_name === entry.user &&
        String(existing.entry_date) === entry.date &&
        existing.client_name === entry.client &&
        existing.project_name === entry.project &&
        (existing.task || "") === (entry.task || "") &&
        Number(existing.hours) === normalizeHours(entry.hours) &&
        (existing.notes || "") === (entry.notes || "")
      )
    : true;

  const status = hasContentChanges
    ? "pending"
    : persistedStatus
      ? normalizeStatus(persistedStatus)
      : "pending";
  const approvedAt = status === "approved" && !hasContentChanges ? existing?.approved_at : null;
  const approvedBy = status === "approved" && !hasContentChanges ? existing?.approved_by_user_id : null;

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
      status,
      approved_at,
      approved_by_user_id,
      account_id,
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
      ${status},
      ${approvedAt},
      ${approvedBy},
      ${accountId},
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
      status = EXCLUDED.status,
      approved_at = EXCLUDED.approved_at,
      approved_by_user_id = EXCLUDED.approved_by_user_id,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;

  return null;
}

async function approveEntry(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Entry id is required.");
  }
  if (!currentUser || normalizeLevel(currentUser.level) < 3) {
    return errorResponse(403, "Manager access required.");
  }

  const rows = await sql`
    SELECT
      id,
      user_name AS user_name,
      client_name AS client_name,
      project_name AS project_name,
      status
    FROM entries
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const entry = rows[0];
  if (!entry) {
    return errorResponse(404, "Entry not found.");
  }
  if (normalizeStatus(entry.status) === "approved") {
    return { message: "Entry already approved." };
  }

  const targetUser = await findUserByDisplayName(sql, entry.user_name, accountId);
  if (!targetUser) {
    return errorResponse(404, "Entry user not found.");
  }

  const currentLevel = normalizeLevel(currentUser.level);
  const targetLevel = normalizeLevel(targetUser.level);
  const isCurrentAdmin = isAdmin(currentUser);

  if (!isCurrentAdmin) {
    if (currentUser.displayName === targetUser.display_name) {
      return errorResponse(403, "You cannot approve your own entries.");
    }
    if (currentLevel <= targetLevel) {
      return errorResponse(403, "You can only approve entries for lower levels.");
    }
  }

  const project = await findProject(sql, entry.client_name, entry.project_name, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (!isCurrentAdmin) {
    const hasAccess = await managerHasProjectAccess(
      sql,
      currentUser.id,
      project.id,
      accountId
    );
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  await sql`
    UPDATE entries
    SET status = 'approved',
        approved_at = NOW(),
        approved_by_user_id = ${currentUser.id},
        updated_at = NOW()
    WHERE id = ${entry.id}
      AND account_id = ${accountId}::uuid
  `;

  return null;
}

async function unapproveEntry(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Entry id is required.");
  }
  if (!currentUser || normalizeLevel(currentUser.level) < 3) {
    return errorResponse(403, "Manager access required.");
  }

  const rows = await sql`
    SELECT
      id,
      user_name AS user_name,
      client_name AS client_name,
      project_name AS project_name,
      status
    FROM entries
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const entry = rows[0];
  if (!entry) {
    return errorResponse(404, "Entry not found.");
  }
  if (normalizeStatus(entry.status) !== "approved") {
    return { message: "Entry is already pending." };
  }

  const targetUser = await findUserByDisplayName(sql, entry.user_name, accountId);
  if (!targetUser) {
    return errorResponse(404, "Entry user not found.");
  }

  const currentLevel = normalizeLevel(currentUser.level);
  const targetLevel = normalizeLevel(targetUser.level);
  const isCurrentAdmin = isAdmin(currentUser);

  if (!isCurrentAdmin) {
    if (currentUser.displayName === targetUser.display_name) {
      return errorResponse(403, "You cannot unapprove your own entries.");
    }
    if (currentLevel <= targetLevel) {
      return errorResponse(403, "You can only unapprove entries for lower levels.");
    }
  }

  const project = await findProject(sql, entry.client_name, entry.project_name, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (!isCurrentAdmin) {
    const hasAccess = await managerHasProjectAccess(
      sql,
      currentUser.id,
      project.id,
      accountId
    );
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  await sql`
    UPDATE entries
    SET status = 'pending',
        approved_at = NULL,
        approved_by_user_id = NULL,
        updated_at = NOW()
    WHERE id = ${entry.id}
      AND account_id = ${accountId}::uuid
  `;

  return null;
}

async function deleteEntry(sql, payload, currentUser, accountId) {
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
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const entry = rows[0];
  if (!entry) {
    return errorResponse(404, "Entry not found.");
  }

  const project = await findProject(sql, entry.client, entry.project, accountId);
  if (!project && !isAdmin(currentUser)) {
    return errorResponse(403, "You are not assigned to this project.");
  }

  if (isAdmin(currentUser)) {
    // Full access.
  } else if (isManager(currentUser)) {
    if (project) {
      const hasAccess = await managerHasProjectAccess(
        sql,
        currentUser.id,
        project.id,
        accountId
      );
      if (!hasAccess) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    }
    const targetUser = await findUserByDisplayName(sql, entry.user, accountId);
    const targetLevel = targetUser ? normalizeLevel(targetUser.level) : 1;
    if (targetUser && targetUser.id !== currentUser.id && targetLevel > 2) {
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
          AND account_id = ${accountId}::uuid
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
    const accountId = context.currentUser?.accountId;

    let mutationResult = null;

    switch (request.action) {
      case "add_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await addClient(sql, request.payload || {}, accountId);
        break;
      }
      case "add_project": {
        if (isAdmin(context.currentUser)) {
          mutationResult = await addProject(
            sql,
            request.payload || {},
            context.currentUser,
            accountId
          );
          break;
        }
        if (!isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const client = await findClient(sql, clientName, accountId);
        if (!client) {
          return errorResponse(404, "Client not found.");
        }
        const hasClientAccess = await managerHasClient(
          sql,
          context.currentUser.id,
          client.id,
          accountId
        );
        if (!hasClientAccess) {
          return errorResponse(403, "You are not assigned to this client.");
        }
        mutationResult = await addProject(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "rename_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await renameClient(sql, request.payload || {}, accountId);
        break;
      }
      case "rename_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await renameProject(sql, request.payload || {}, accountId);
        break;
      }
      case "remove_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await removeClient(sql, request.payload || {}, accountId);
        break;
      }
      case "remove_project": {
        if (isAdmin(context.currentUser)) {
          mutationResult = await removeProject(sql, request.payload || {}, accountId);
          break;
        }
        if (!isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        const project = await findProject(sql, clientName, projectName, accountId);
        if (!project) {
          return errorResponse(404, "Project not found.");
        }
        const projectRow = await sql`
          SELECT created_by
          FROM projects
          WHERE id = ${project.id}
            AND account_id = ${accountId}::uuid
          LIMIT 1
        `;
        const createdBy = projectRow[0]?.created_by || "";
        if (createdBy !== context.currentUser.id) {
          return errorResponse(403, "You can only remove projects you created.");
        }
        mutationResult = await removeProject(sql, request.payload || {}, accountId);
        break;
      }
      case "save_entry":
        mutationResult = await saveEntry(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      case "delete_entry":
        mutationResult = await deleteEntry(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      case "approve_entry":
        mutationResult = await approveEntry(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      case "unapprove_entry":
        mutationResult = await unapproveEntry(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      case "assign_manager_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await assignManagerToClient(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "unassign_manager_client": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await unassignManagerFromClient(
          sql,
          request.payload || {},
          accountId
        );
        break;
      }
      case "assign_manager_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await assignManagerToProject(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "unassign_manager_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await unassignManagerFromProject(
          sql,
          request.payload || {},
          accountId
        );
        break;
      }
      case "update_manager_project_rate": {
        mutationResult = await updateManagerProjectRate(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "add_project_member": {
        if (!isAdmin(context.currentUser) && !isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        mutationResult = await addProjectMember(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "remove_project_member": {
        if (!isAdmin(context.currentUser) && !isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        mutationResult = await removeProjectMember(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "update_project_member_rate": {
        mutationResult = await updateProjectMemberRate(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "add_user": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const desiredLevel = normalizeLevel(request.payload?.level ?? request.payload?.role);
        const level = isGlobalAdmin(context.currentUser) ? desiredLevel : 1;
        await createUserRecord(sql, {
          ...(request.payload || {}),
          level,
          accountId,
        });
        break;
      }
      case "update_user": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        const desiredLevel = normalizeLevel(request.payload?.level ?? request.payload?.role);
        const nextLevel = isGlobalAdmin(context.currentUser)
          ? desiredLevel
          : normalizeLevel(target.level);
        if (!isGlobalAdmin(context.currentUser) && normalizeLevel(target.level) >= 6) {
          return errorResponse(403, "Admin access required.");
        }
        const maybeCurrentUser = await updateUserRecord(
          sql,
          { ...(request.payload || {}), level: nextLevel },
          context.currentUser
        );
        if (maybeCurrentUser) {
          context.currentUser = maybeCurrentUser;
        }
        break;
      }
      case "reset_user_password": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        if (!isGlobalAdmin(context.currentUser) && normalizeLevel(target.level) >= 6) {
          return errorResponse(403, "Admin access required.");
        }
        await updateUserPassword(sql, request.payload || {}, accountId);
        break;
      }
      case "deactivate_user": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        if (!isGlobalAdmin(context.currentUser) && normalizeLevel(target.level) >= 6) {
          return errorResponse(403, "Admin access required.");
        }
        await deactivateUser(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "update_level_labels": {
        const adminError = requireSuperAdmin(context);
        if (adminError) return adminError;
        mutationResult = await updateLevelLabels(sql, request.payload || {}, accountId);
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
