"use strict";
const crypto = require("crypto");

const {
  createSession,
  createUserRecord,
  createPasswordSetupToken,
  deactivateUser,
  ensureSchema,
  errorResponse,
  findClient,
  findProject,
  findUserByDisplayName,
  findUserById,
  hashPassword,
  getSessionContext,
  getSql,
  getManagerScope,
  json,
  loadState,
  listLevelLabels,
  listAuditLogs,
  normalizeLevel,
  normalizeText,
  parseBody,
  requireAdmin,
  requireSuperAdmin,
  requireAuth,
  updateUserPassword,
  updateUserRecord,
  verifyPassword,
  randomId,
  logAudit,
} = require("./_db");
const permissions = require("./permissions");
const {
  buildInboxMessage,
  listManagerRecipientUserIds,
  createSystemInboxItems,
} = require("./_inbox");

function hashSetupToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function completePasswordSetup(sql, payload) {
  const token = normalizeText(payload?.token);
  const password = String(payload?.password || "");
  if (!token) {
    return errorResponse(400, "Setup token is required.");
  }
  if (password.length < 8) {
    return errorResponse(400, "Password must be at least 8 characters.");
  }

  const tokenHash = hashSetupToken(token);
  const rows = await sql`
    SELECT id, user_id, account_id, expires_at, used_at
    FROM password_setup_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const record = rows[0];
  if (!record) {
    return errorResponse(400, "Invalid setup token.");
  }
  if (record.used_at) {
    return errorResponse(400, "This setup link has already been used.");
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return errorResponse(400, "This setup link has expired.");
  }

  const nowIso = new Date().toISOString();
  await sql`
    UPDATE users
    SET
      password_hash = ${hashPassword(password)},
      must_change_password = FALSE,
      updated_at = ${nowIso}
    WHERE id = ${record.user_id}
      AND account_id = ${record.account_id}::uuid
  `;
  await sql`
    UPDATE password_setup_tokens
    SET used_at = ${nowIso}
    WHERE id = ${record.id}
      AND used_at IS NULL
  `;

  const session = await createSession(sql, record.user_id);
  return { ok: true, sessionToken: session?.token || null };
}

async function sendSetupEmail({ to, username, token }) {
  const { handler: sendEmailHandler } = require("./send-email");
  const setupLink = `https://trakmetric.com/set-password?token=${encodeURIComponent(token)}`;
  const subject = "Set up your Trakmetric password";
  const html = `
    <p>Your Trakmetric account has been created.</p>
    <p><strong>User ID:</strong> ${username}</p>
    <p>Set your password by clicking the link below:</p>
    <p><a href="${setupLink}">${setupLink}</a></p>
    <p>This link expires in 48 hours and can only be used once.</p>
  `;
  console.log("[add_user] setup email send triggered", {
    to,
    username,
    endpoint: "/.netlify/functions/send-email",
  });
  if (typeof sendEmailHandler !== "function") {
    throw new Error("send-email handler is unavailable");
  }
  let result;
  try {
    result = await sendEmailHandler({
      httpMethod: "POST",
      body: JSON.stringify({ to, subject, html }),
    });
  } catch (error) {
    console.error("[add_user] send-email invocation failed", {
      to,
      username,
      error: error?.message || String(error),
    });
    throw error;
  }
  console.log("[add_user] send-email result", {
    statusCode: result?.statusCode,
    body: result?.body || null,
  });
  if (!result || Number(result.statusCode) >= 400) {
    const parsed = JSON.parse(result?.body || "{}");
    throw new Error(parsed.error || "Unable to send setup email.");
  }
}

async function createDepartment(sql, payload, accountId) {
  const name = normalizeText(payload.name);
  if (!name) {
    return errorResponse(400, "Department name is required.");
  }
  const id = normalizeText(payload.id) || randomId();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO departments (id, account_id, name, is_active, created_at, updated_at)
    VALUES (${id}, ${accountId}::uuid, ${name}, TRUE, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;
  return { id, name, isActive: true };
}

async function renameDepartment(sql, payload, accountId) {
  const id = normalizeText(payload.id);
  const name = normalizeText(payload.name);
  if (!id || !name) {
    return errorResponse(400, "Department id and name are required.");
  }
  const now = new Date().toISOString();
  const result = await sql`
    UPDATE departments
    SET name = ${name}, updated_at = ${now}
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    RETURNING id, name, is_active AS "isActive"
  `;
  if (!result[0]) {
    return errorResponse(404, "Department not found.");
  }
  return result[0];
}

async function setDepartmentActive(sql, payload, accountId) {
  const id = normalizeText(payload.id);
  const isActive = payload.isActive === false ? false : true;
  if (!id) {
    return errorResponse(400, "Department id is required.");
  }
  const now = new Date().toISOString();
  const result = await sql`
    UPDATE departments
    SET is_active = ${isActive}, updated_at = ${now}
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    RETURNING id, name, is_active AS "isActive"
  `;
  if (!result[0]) {
    return errorResponse(404, "Department not found.");
  }
  return result[0];
}

async function setUserDepartment(sql, payload, accountId) {
  const userId = normalizeText(payload.userId);
  const departmentId = payload.departmentId ? normalizeText(payload.departmentId) : null;
  if (!userId) {
    return errorResponse(400, "User id is required.");
  }
  if (departmentId) {
    const dept = await sql`
      SELECT id
      FROM departments
      WHERE id = ${departmentId}
        AND account_id = ${accountId}::uuid
        AND is_active = TRUE
      LIMIT 1
    `;
    if (!dept[0]) {
      return errorResponse(404, "Department not found or inactive.");
    }
  }
  const result = await sql`
    UPDATE users
    SET department_id = ${departmentId}, updated_at = ${new Date().toISOString()}
    WHERE id = ${userId}
      AND account_id = ${accountId}::uuid
    RETURNING id, department_id AS "departmentId"
  `;
  if (!result[0]) {
    return errorResponse(404, "User not found.");
  }
  return result[0];
}

async function setUserLevel(sql, payload, accountId) {
  const userId = normalizeText(payload.userId);
  const level = normalizeLevel(payload.level);
  if (!userId) {
    return errorResponse(400, "User id is required.");
  }
  if (!level) {
    return errorResponse(400, "Level is required.");
  }

  const valid = await sql`
    SELECT 1
    FROM level_labels
    WHERE account_id = ${accountId}::uuid
      AND level = ${level}
    LIMIT 1
  `;
  if (!valid[0]) {
    return errorResponse(400, "Invalid level.");
  }

  const result = await sql`
    UPDATE users
    SET level = ${level}, updated_at = ${new Date().toISOString()}
    WHERE id = ${userId}
      AND account_id = ${accountId}::uuid
    RETURNING id, level
  `;
  if (!result[0]) {
    return errorResponse(404, "User not found.");
  }
  return result[0];
}

function normalizeDateString(value) {
  if (!value) return "";
  // Already a YYYY-MM-DD string
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  // Date object or parsable string
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : NaN;
}

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

function validateExpense(expense) {
  if (!expense || typeof expense !== "object") {
    return "Expense payload is required.";
  }
  if (!normalizeText(expense.userId)) {
    return "Team member is required.";
  }
  if (!normalizeText(expense.clientName)) {
    return "Client is required.";
  }
  if (!normalizeText(expense.projectName)) {
    return "Project is required.";
  }
  if (!normalizeText(expense.expenseDate)) {
    return "Date is required.";
  }
  if (!normalizeText(expense.category)) {
    return "Category is required.";
  }
  const amount = normalizeAmount(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Amount must be a positive number.";
  }
  return "";
}

let requestLevelLabels = {};

function permissionGroupForUser(user) {
  if (!user) return "staff";
  if (typeof user === "number") {
    const normalized = normalizeLevel(user);
    const value = requestLevelLabels?.[normalized];
    if (value && typeof value === "object") {
      if (value.permissionGroup) return String(value.permissionGroup).toLowerCase();
      if (value.permission_group) return String(value.permission_group).toLowerCase();
    }
    return "staff";
  }
  if (user.permissionGroup) return String(user.permissionGroup).toLowerCase();
  const normalized = normalizeLevel(user.level);
  const value = requestLevelLabels?.[normalized];
  if (value && typeof value === "object") {
    if (value.permissionGroup) return String(value.permissionGroup).toLowerCase();
    if (value.permission_group) return String(value.permission_group).toLowerCase();
  }
  return "staff";
}

function isStaff(user) {
  return permissionGroupForUser(user) === "staff";
}

function isManager(user) {
  const group = permissionGroupForUser(user);
  return (
    group === "manager" ||
    group === "admin" ||
    group === "superuser" ||
    group === "executive"
  );
}

function isExecutive(user) {
  const group = permissionGroupForUser(user);
  return group === "executive" || group === "admin" || group === "superuser";
}

function isAdmin(user) {
  const group = permissionGroupForUser(user);
  return group === "admin" || group === "superuser";
}

function isGlobalAdmin(user) {
  return isAdmin(user);
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase() === "approved"
    ? "approved"
    : "pending";
}

async function markInboxItemRead(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload?.id);
  if (!id) {
    return errorResponse(400, "Inbox item id is required.");
  }
  const rows = await sql`
    UPDATE inbox_items
    SET is_read = TRUE
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
      AND recipient_user_id = ${currentUser.id}
    RETURNING id
  `;
  if (!rows[0]) {
    return errorResponse(404, "Inbox item not found.");
  }
  return null;
}

async function deleteInboxItem(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload?.id);
  if (!id) {
    return errorResponse(400, "Inbox item id is required.");
  }
  const rows = await sql`
    UPDATE inbox_items
    SET is_deleted = TRUE
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
      AND recipient_user_id = ${currentUser.id}
      AND is_deleted = FALSE
    RETURNING id
  `;
  if (!rows[0]) {
    return errorResponse(404, "Inbox item not found.");
  }
  return null;
}

async function deleteInboxItems(sql, payload, currentUser, accountId) {
  const ids = Array.isArray(payload?.ids)
    ? Array.from(new Set(payload.ids.map((id) => normalizeText(id)).filter(Boolean)))
    : [];
  if (!ids.length) {
    return errorResponse(400, "At least one inbox item id is required.");
  }
  for (const id of ids) {
    await sql`
      UPDATE inbox_items
      SET is_deleted = TRUE
      WHERE id = ${id}
        AND account_id = ${accountId}::uuid
        AND recipient_user_id = ${currentUser.id}
        AND is_deleted = FALSE
    `;
  }
  return null;
}

async function deleteAllReadInboxItems(sql, _payload, currentUser, accountId) {
  await sql`
    UPDATE inbox_items
    SET is_deleted = TRUE
    WHERE account_id = ${accountId}::uuid
      AND recipient_user_id = ${currentUser.id}
      AND is_read = TRUE
      AND is_deleted = FALSE
  `;
  return null;
}

function diffKeys(before, after) {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  const changed = [];
  for (const key of keys) {
    const a = before ? before[key] : undefined;
    const b = after ? after[key] : undefined;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(key);
    }
  }
  return changed;
}

function entrySnapshot({
  date,
  userId,
  clientId,
  projectId,
  hours,
  notes,
  nonbillable,
  status,
}) {
  return {
    date,
    user_id: userId || null,
    client_id: clientId || null,
    project_id: projectId || null,
    hours: hours !== undefined && hours !== null ? Number(hours) : null,
    notes: notes || "",
    nonbillable: Boolean(nonbillable),
    status: status || "pending",
  };
}

function expenseSnapshot({
  date,
  userId,
  clientId,
  projectId,
  amount,
  notes,
  nonbillable,
  status,
  category,
}) {
  return {
    date,
    user_id: userId || null,
    client_id: clientId || null,
    project_id: projectId || null,
    amount: amount !== undefined && amount !== null ? Number(amount) : null,
    notes: notes || "",
    nonbillable: Boolean(nonbillable),
    status: status || "pending",
    category: category || "",
  };
}

async function changeOwnPassword(sql, payload, currentUser, accountId) {
  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");
  if (!currentPassword || !newPassword) {
    return errorResponse(400, "Current and new passwords are required.");
  }
  if (newPassword.length < 8) {
    return errorResponse(400, "New password must be at least 8 characters.");
  }
  const user = await findUserById(sql, currentUser.id, accountId);
  if (!user) {
    return errorResponse(404, "User not found.");
  }
  if (!verifyPassword(currentPassword, user.password_hash)) {
    return errorResponse(403, "Current password is incorrect.");
  }

  await sql`
    UPDATE users
    SET
      password_hash = ${hashPassword(newPassword)},
      must_change_password = FALSE,
      updated_at = NOW()
    WHERE id = ${user.id}
      AND account_id = ${accountId}::uuid
  `;
  return null;
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

  if (typeof entry.billable !== "boolean") {
    entry.billable = true;
  }

  return "";
}

async function updateLevelLabels(sql, payload, accountId) {
  const levels = Array.isArray(payload?.levels)
    ? payload.levels
    : [];

  if (!levels.length) {
    return errorResponse(400, "Level definitions are required.");
  }

  const validGroups = new Set(["staff", "manager", "executive", "admin", "superuser"]);
  const seenLevels = new Set();
  const seenLabels = new Set();
  const cleaned = [];

  for (const item of levels) {
    const level = normalizeLevel(item.level);
    const label = normalizeText(item.label);
    const group = normalizeText(item.permissionGroup);
    if (!level || !label) {
      return errorResponse(400, "Each level needs a number and label.");
    }
    if (seenLevels.has(level)) {
      return errorResponse(400, "Duplicate level numbers are not allowed.");
    }
    seenLevels.add(level);
    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      return errorResponse(400, "Duplicate level labels are not allowed.");
    }
    seenLabels.add(labelKey);
    const permissionGroup = validGroups.has(group) ? group : "staff";
    cleaned.push({ level, label, permissionGroup });
  }

  // Delete levels that are not present in the submitted list
  const existing = await sql`
    SELECT level
    FROM level_labels
    WHERE account_id = ${accountId}::uuid
  `;
  const keepLevels = cleaned.map((c) => c.level);

  // Upsert submitted levels
  const now = new Date().toISOString();
  for (const item of cleaned) {
    await sql`
      INSERT INTO level_labels (account_id, level, label, permission_group, updated_at)
      VALUES (${accountId}::uuid, ${item.level}, ${item.label}, ${item.permissionGroup}, ${now})
      ON CONFLICT (account_id, level) DO UPDATE SET
        label = EXCLUDED.label,
        permission_group = EXCLUDED.permission_group,
        updated_at = EXCLUDED.updated_at
    `;
  }

  if (existing.length && keepLevels.length) {
    await sql`
      DELETE FROM level_labels
      WHERE account_id = ${accountId}::uuid
        AND level <> ALL(${keepLevels})
    `;
  }

  return null;
}

async function updateExpenseCategories(sql, payload, accountId) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  if (!categories.length) {
    return errorResponse(400, "Expense categories are required.");
  }

  const cleaned = [];
  const seen = new Set();
  for (const item of categories) {
    const id = normalizeText(item.id);
    const name = normalizeText(item.name);
    const isActive = item.isActive === false || item.isActive === 0 ? false : true;
    if (!name) {
      return errorResponse(400, "Category name cannot be blank.");
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return errorResponse(400, "Category names must be unique.");
    }
    seen.add(key);
    cleaned.push({ id, name, isActive });
  }

  const existing = await sql`
    SELECT id, name
    FROM expense_categories
    WHERE account_uuid = ${accountId}::uuid
  `;
  const existingByName = new Map(
    existing.map((row) => [row.name.toLowerCase(), row.id])
  );

  for (const item of cleaned) {
    const conflictId = existingByName.get(item.name.toLowerCase());
    if (conflictId && conflictId !== item.id) {
      return errorResponse(400, `Category "${item.name}" already exists.`);
    }
  }

  // Delete categories that are not present in the submitted list
  const keepIds = new Set(cleaned.filter((c) => c.id).map((c) => c.id));
  for (const existingRow of existing) {
    if (existingRow.id && !keepIds.has(existingRow.id)) {
      await sql`
        DELETE FROM expense_categories
        WHERE account_uuid = ${accountId}::uuid
          AND id = ${existingRow.id}
      `;
    }
  }

  for (const item of cleaned) {
    const now = new Date().toISOString();
    if (item.id) {
      const result = await sql`
        UPDATE expense_categories
        SET name = ${item.name},
            is_active = ${item.isActive ? 1 : 0},
            created_at = COALESCE(created_at, ${now})
        WHERE id = ${item.id}
          AND account_uuid = ${accountId}::uuid
        RETURNING id
      `;
      if (!result[0]) {
        await sql`
          INSERT INTO expense_categories (id, account_uuid, name, is_active, created_at)
          VALUES (${item.id}, ${accountId}::uuid, ${item.name}, ${item.isActive ? 1 : 0}, ${now})
        `;
      }
    } else {
      await sql`
        INSERT INTO expense_categories (id, account_uuid, name, is_active, created_at)
        VALUES (${randomId()}, ${accountId}::uuid, ${item.name}, ${item.isActive ? 1 : 0}, ${now})
      `;
    }
  }

  return null;
}

async function updateOfficeLocations(sql, payload, accountId) {
  const locations = Array.isArray(payload?.locations) ? payload.locations : [];

  const cleaned = [];
  const seen = new Set();
  for (const item of locations) {
    const id = normalizeText(item.id) || randomId();
    const name = normalizeText(item.name);
    const officeLeadUserId = normalizeText(item.officeLeadUserId) || null;
    if (!name) {
      return errorResponse(400, "Location name cannot be blank.");
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return errorResponse(400, "Location names must be unique.");
    }
    seen.add(key);
    cleaned.push({ id, name, officeLeadUserId });
  }

  const existing = await sql`
    SELECT id, name
    FROM office_locations
    WHERE account_id = ${accountId}::uuid
  `;
  const existingByName = new Map(existing.map((row) => [row.name.toLowerCase(), row.id]));

  for (const item of cleaned) {
    const conflictId = existingByName.get(item.name.toLowerCase());
    if (conflictId && conflictId !== item.id) {
      return errorResponse(400, `Location "${item.name}" already exists.`);
    }
  }

  const keepIds = new Set(cleaned.map((c) => c.id));
  for (const existingRow of existing) {
    if (existingRow.id && !keepIds.has(existingRow.id)) {
      await sql`
        DELETE FROM office_locations
        WHERE account_id = ${accountId}::uuid
          AND id = ${existingRow.id}
      `;
    }
  }

  for (const item of cleaned) {
    await sql`
      INSERT INTO office_locations (id, account_id, name, office_lead_user_id)
      VALUES (${item.id}, ${accountId}::uuid, ${item.name}, ${item.officeLeadUserId})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        office_lead_user_id = EXCLUDED.office_lead_user_id
    `;
  }

  return null;
}
async function addClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  if (!clientName) {
    return errorResponse(400, "Client name is required.");
  }

  const clean = (value) => {
    const text = normalizeText(value);
    return text || null;
  };

  if (await findClient(sql, clientName, accountId)) {
    return errorResponse(409, "That client already exists.");
  }

  const now = new Date().toISOString();
  const inserted = await sql`
    INSERT INTO clients (
      account_id,
      name,
      office_id,
      business_contact_name,
      business_contact_email,
      business_contact_phone,
      billing_contact_name,
      billing_contact_email,
      billing_contact_phone,
      address_street,
      address_city,
      address_state,
      address_postal,
      client_address,
      created_at,
      updated_at
    )
    VALUES (
      ${accountId}::uuid,
      ${clientName},
      ${clean(payload.officeId)},
      ${clean(payload.businessContactName)},
      ${clean(payload.businessContactEmail)},
      ${clean(payload.businessContactPhone)},
      ${clean(payload.billingContactName)},
      ${clean(payload.billingContactEmail)},
      ${clean(payload.billingContactPhone)},
      ${clean(payload.addressStreet)},
      ${clean(payload.addressCity)},
      ${clean(payload.addressState)},
      ${clean(payload.addressPostal)},
      ${clean(payload.addressStreet)},
      ${now},
      ${now}
    )
    RETURNING id, name
  `;

  const clientId = inserted[0]?.id;

  if (clientId && !(await findProject(sql, clientName, "Administrative", accountId))) {
    await sql`
      INSERT INTO projects (client_id, account_id, name)
      VALUES (${clientId}, ${accountId}::uuid, 'Administrative')
    `;
  }
  return null;
}

async function updateClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const nextNameRaw = normalizeText(payload.nextName) || clientName;
  if (!clientName) {
    return errorResponse(400, "Client name is required.");
  }

  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  const nextName = nextNameRaw || client.name;
  if (nextName.toLowerCase() !== client.name.toLowerCase()) {
    const conflict = await findClient(sql, nextName, accountId);
    if (conflict && conflict.id !== client.id) {
      return errorResponse(409, "That client already exists.");
    }
  }

  const clean = (value) => {
    const text = normalizeText(value);
    return text || null;
  };

  await sql`
    UPDATE clients
    SET
      name = ${nextName},
      office_id = ${clean(payload.officeId)},
      business_contact_name = ${clean(payload.businessContactName)},
      business_contact_email = ${clean(payload.businessContactEmail)},
      business_contact_phone = ${clean(payload.businessContactPhone)},
      billing_contact_name = ${clean(payload.billingContactName)},
      billing_contact_email = ${clean(payload.billingContactEmail)},
      billing_contact_phone = ${clean(payload.billingContactPhone)},
      address_street = ${clean(payload.addressStreet)},
      address_city = ${clean(payload.addressCity)},
      address_state = ${clean(payload.addressState)},
      address_postal = ${clean(payload.addressPostal)},
      client_address = ${clean(payload.addressStreet)},
      updated_at = NOW()
    WHERE id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;

  await sql`
    UPDATE projects
    SET office_id = ${clean(payload.officeId)}
    WHERE client_id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;

  if (nextName.toLowerCase() !== client.name.toLowerCase()) {
    await sql`
      UPDATE entries
      SET client_name = ${nextName}
      WHERE LOWER(client_name) = LOWER(${client.name})
        AND account_id = ${accountId}::uuid
    `;
    await sql`
      UPDATE expenses
      SET client_name = ${nextName}
      WHERE LOWER(client_name) = LOWER(${client.name})
        AND account_id = ${accountId}::uuid
    `;
  }

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
    INSERT INTO projects (client_id, account_id, office_id, name, created_by)
    VALUES (${client.id}, ${accountId}::uuid, ${client.office_id || null}, ${projectName}, ${currentUser?.id || null})
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

async function collectUserProjectIdsForClient(sql, user, clientId, accountId) {
  if (!user) return [];
  const userId = user.id;
  const managerRows = await sql`
    SELECT projects.id
    FROM manager_projects
    JOIN projects ON projects.id = manager_projects.project_id
    WHERE manager_projects.manager_id = ${userId}
      AND projects.client_id = ${clientId}
      AND manager_projects.account_id = ${accountId}::uuid
  `;
  const memberRows = await sql`
    SELECT projects.id
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    WHERE project_members.user_id = ${userId}
      AND projects.client_id = ${clientId}
      AND project_members.account_id = ${accountId}::uuid
  `;
  return [...new Set([...managerRows.map((r) => r.id), ...memberRows.map((r) => r.id)])];
}

async function assignManagerToClient(sql, payload, currentUser, accountId) {
  const managerId = normalizeText(payload.managerId);
  const clientName = normalizeText(payload.clientName);
  if (!managerId || !clientName) {
    return errorResponse(400, "Manager and client are required.");
  }

  if (!isExecutive(currentUser) && !isAdmin(currentUser)) {
    return errorResponse(403, "Executive or Admin access required.");
  }

  const manager = await findUserById(sql, managerId, accountId);
  if (!manager || (!isManager(manager) && !isExecutive(manager) && !isAdmin(manager))) {
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

  if (!isExecutive(currentUser) && !isAdmin(currentUser)) {
    return errorResponse(403, "Executive or Admin access required.");
  }

  const manager = await findUserById(sql, managerId, accountId);
  if (!manager || (!isManager(manager) && !isExecutive(manager) && !isAdmin(manager))) {
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
  if (!user || permissionGroupForUser(user.level) !== "staff") {
    return errorResponse(404, "Staff member not found.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const targetUser = await findUserById(sql, userId, accountId);
  if (!targetUser) {
    return errorResponse(404, "Member not found.");
  }

  if (isManager(currentUser) && !isAdmin(currentUser)) {
    if (permissionGroupForUser(targetUser.level) !== "staff") {
      return errorResponse(403, "Managers can only remove staff.");
    }
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

  if (isManager(currentUser) && !isAdmin(currentUser)) {
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
      AND (account_id = ${accountId}::uuid OR account_id IS NULL)
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

  const targetUser = await findUserById(sql, userId, accountId);
  if (!targetUser) {
    return errorResponse(404, "Member not found.");
  }

  if (permissionGroupForUser(targetUser.level) !== "staff") {
    return errorResponse(403, "Only staff entries can be updated.");
  }

  if (isManager(currentUser) && !isAdmin(currentUser)) {
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

  if (isManager(currentUser) && !isAdmin(currentUser)) {
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
  return updateClient(sql, payload, accountId);
}

async function createExpense(sql, payload, currentUser, accountId) {
  const expense = payload.expense || {};
  const validationError = validateExpense(expense);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const project = await findProject(sql, expense.clientName, expense.projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const targetUser = await findUserById(sql, expense.userId, accountId);
  if (!targetUser) {
    return errorResponse(404, "Team member not found.");
  }
  const targetGroup = permissionGroupForUser(targetUser.level);

  if (isAdmin(currentUser)) {
    // full access
  } else if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
    if (targetUser.id !== currentUser.id && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only edit staff expenses.");
    }
  } else if (isStaff(currentUser)) {
    if (targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save expenses for your own account.");
    }
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

  const now = new Date().toISOString();
  const id = normalizeText(expense.id) || randomId();
  const isBillable = expense.isBillable === false || expense.isBillable === 0 ? 0 : 1;

  await sql`
    INSERT INTO expenses (
      id,
      account_id,
      user_id,
      client_name,
      project_name,
      expense_date,
      category,
      amount,
      is_billable,
      notes,
      status,
      approved_at,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${accountId}::uuid,
      ${targetUser.id},
      ${expense.clientName},
      ${expense.projectName},
      ${expense.expenseDate},
      ${expense.category},
      ${normalizeAmount(expense.amount)},
      ${isBillable},
      ${normalizeText(expense.notes)},
      'pending',
      NULL,
      ${now},
      ${now}
    )
  `;

  const afterSnapshot = expenseSnapshot({
    date: expense.expenseDate,
    userId: targetUser.id,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    amount: normalizeAmount(expense.amount),
    notes: normalizeText(expense.notes),
    nonbillable: isBillable ? false : true,
    status: "pending",
    category: expense.category,
  });

  await logAudit(sql, {
    accountId,
    entityType: "expense",
    entityId: id,
    action: "create",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: targetUser.id,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: null,
    afterJson: afterSnapshot,
    changedFieldsJson: diffKeys({}, afterSnapshot || {}),
  });

  const managerRecipientUserIds = await listManagerRecipientUserIds(sql, {
    accountId,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
  });
  const recipients = managerRecipientUserIds.filter((userId) => userId !== currentUser?.id);
  await createSystemInboxItems(sql, {
    accountId,
    type: "expense_entry_created",
    recipientUserIds: recipients,
    actorUserId: currentUser?.id || null,
    subjectType: "expense",
    subjectId: id,
    projectName: expense.projectName,
    message: buildInboxMessage("expense_entry_created", {
      actorName: currentUser?.displayName || "",
      clientName: expense.clientName,
      projectName: expense.projectName,
      date: normalizeText(expense.expenseDate),
      amount: normalizeAmount(expense.amount),
    }),
    deepLink: {
      view: "entries",
      subtab: "expenses",
      subjectId: id,
    },
  });

  return null;
}

async function updateExpense(sql, payload, currentUser, accountId) {
  const expense = payload.expense || {};
  const id = normalizeText(expense.id);
  if (!id) {
    return errorResponse(400, "Expense id is required.");
  }

  const existingRows = await sql`
    SELECT *
    FROM expenses
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) {
    return errorResponse(404, "Expense not found.");
  }

  const safeExpense = {
    ...existing,
    ...expense,
    userId: expense.userId || expense.user_id || existing.user_id,
    clientName: normalizeText(expense.clientName) || existing.client_name,
    projectName: normalizeText(expense.projectName) || existing.project_name,
    expenseDate: expense.expenseDate || expense.expense_date,
    category: expense.category || existing.category,
    amount: expense.amount !== undefined ? expense.amount : existing.amount,
    isBillable:
      expense.isBillable !== undefined
        ? expense.isBillable
        : expense.is_billable !== undefined
          ? expense.is_billable !== 0
          : existing.is_billable !== 0,
  };

  const validationError = validateExpense(safeExpense);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const previousProject = await findProject(sql, existing.client_name, existing.project_name, accountId);
  const project = await findProject(sql, safeExpense.clientName, safeExpense.projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const targetUserId = normalizeText(safeExpense.userId) || existing.user_id;
  const targetUser = await findUserById(sql, targetUserId, accountId);
  if (!targetUser) {
    return errorResponse(404, "Team member not found.");
  }
  const targetGroup = permissionGroupForUser(targetUser.level);

  if (isAdmin(currentUser)) {
    // full access
  } else if (isManager(currentUser)) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
    if (targetUser.id !== currentUser.id && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only edit staff expenses.");
    }
  } else if (isStaff(currentUser)) {
    if (targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save expenses for your own account.");
    }
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

  const isBillable = safeExpense.isBillable === false || safeExpense.isBillable === 0 ? 0 : 1;
  const now = new Date().toISOString();

  const beforeSnapshot = expenseSnapshot({
    date: normalizeText(existing.expense_date),
    userId: existing.user_id,
    clientId: previousProject?.client_id || null,
    projectId: previousProject?.id || null,
    amount: existing.amount,
    notes: existing.notes,
    nonbillable: existing.is_billable === 0,
    status: existing.status,
    category: existing.category,
  });

  const afterSnapshot = expenseSnapshot({
    date: normalizeText(safeExpense.expenseDate),
    userId: targetUser.id,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    amount: normalizeAmount(safeExpense.amount),
    notes: normalizeText(safeExpense.notes),
    nonbillable: isBillable === 0,
    status: existing.status,
    category: safeExpense.category,
  });

  await sql`
    UPDATE expenses
    SET
      user_id = ${targetUser.id},
      client_name = ${safeExpense.clientName},
      project_name = ${safeExpense.projectName},
      expense_date = ${safeExpense.expenseDate},
      category = ${safeExpense.category},
      amount = ${normalizeAmount(safeExpense.amount)},
      is_billable = ${isBillable},
      notes = ${normalizeText(safeExpense.notes)},
      updated_at = ${now}
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
  `;

  await logAudit(sql, {
    accountId,
    entityType: "expense",
    entityId: id,
    action: "update",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: targetUser.id,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: afterSnapshot,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, afterSnapshot || {}),
  });

  return null;
}

async function deleteExpense(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Expense id is required.");
  }

  const rows = await sql`
    SELECT *
    FROM expenses
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const expense = rows[0];
  if (!expense) {
    return errorResponse(404, "Expense not found.");
  }

  const project = await findProject(sql, expense.client_name, expense.project_name, accountId);
  const targetUser = await findUserById(sql, expense.user_id, accountId);
  if (!project && !isAdmin(currentUser)) {
    return errorResponse(403, "You are not assigned to this project.");
  }

  if (isAdmin(currentUser)) {
    // full access
  } else if (isManager(currentUser)) {
    if (project) {
      const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
      if (!hasAccess) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    }
    const targetGroup = permissionGroupForUser(targetUser);
    if (targetUser && targetUser.id !== currentUser.id && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only edit staff expenses.");
    }
  } else if (isStaff(currentUser)) {
    if (expense.user_id !== currentUser.id) {
      return errorResponse(403, "You can only delete your own expenses.");
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

  const beforeSnapshot = expenseSnapshot({
    date: expense.expense_date,
    userId: expense.user_id,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    amount: expense.amount,
    notes: expense.notes,
    nonbillable: expense.is_billable === 0,
    status: expense.status,
    category: expense.category,
  });

  await sql`
    DELETE FROM expenses
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
  `;

  await logAudit(sql, {
    accountId,
    entityType: "expense",
    entityId: id,
    action: "delete",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: targetUser?.id || null,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: null,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, {}),
  });

  return null;
}

async function toggleExpenseStatus(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Expense id is required.");
  }
  if (!currentUser || permissionGroupForUser(currentUser.level) === "staff") {
    return errorResponse(403, "Manager access required.");
  }

  const rows = await sql`
    SELECT *
    FROM expenses
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const expense = rows[0];
  if (!expense) {
    return errorResponse(404, "Expense not found.");
  }

  const targetUser = await findUserById(sql, expense.user_id, accountId);
  if (!targetUser) {
    return errorResponse(404, "Expense user not found.");
  }

  const currentGroup = permissionGroupForUser(currentUser.level);
  const targetGroup = permissionGroupForUser(targetUser.level);
  const isCurrentAdmin = isAdmin(currentUser);

  if (!isCurrentAdmin) {
    if (currentUser.id === targetUser.id) {
      return errorResponse(403, "You cannot approve your own expenses.");
    }
    if (currentGroup === "manager" && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only approve staff expenses.");
    }
  }

  const project = await findProject(sql, expense.client_name, expense.project_name, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  if (!isCurrentAdmin) {
    const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
    if (!hasAccess) {
      return errorResponse(403, "You are not assigned to this project.");
    }
  }

  const nextStatus = normalizeStatus(expense.status) === "approved" ? "pending" : "approved";
  const approvedAt = nextStatus === "approved" ? new Date().toISOString() : null;

  const beforeSnapshot = expenseSnapshot({
    date: expense.expense_date,
    userId: expense.user_id,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    amount: expense.amount,
    notes: expense.notes,
    nonbillable: expense.is_billable === 0,
    status: expense.status,
    category: expense.category,
  });
  const afterSnapshot = { ...beforeSnapshot, status: nextStatus };

  await sql`
    UPDATE expenses
    SET status = ${nextStatus},
        approved_at = ${approvedAt},
        updated_at = NOW()
    WHERE id = ${expense.id}
      AND account_id = ${accountId}::uuid
  `;

  await logAudit(sql, {
    accountId,
    entityType: "expense",
    entityId: expense.id,
    action: nextStatus === "approved" ? "approve" : "unapprove",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: targetUser?.id || null,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: afterSnapshot,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, afterSnapshot || {}),
  });

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

async function updateProject(sql, payload, currentUser, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const nextName = normalizeText(payload.nextName || projectName);
  const budgetRaw = payload.budgetAmount;
  const hasBudget = budgetRaw !== undefined && budgetRaw !== null && budgetRaw !== "";
  const budgetAmount = hasBudget ? Number(budgetRaw) : null;

  if (!clientName || !projectName) {
    return errorResponse(404, "Project not found.");
  }
  if (!nextName) {
    return errorResponse(400, "Project name is required.");
  }
  if (hasBudget && (Number.isNaN(budgetAmount) || budgetAmount < 0)) {
    return errorResponse(400, "Budget must be a non-negative number.");
  }

  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }
  const nextBudget =
    hasBudget && !Number.isNaN(budgetAmount) && budgetAmount >= 0
      ? budgetAmount
      : project.budget !== undefined
        ? project.budget
        : null;

  // Reuse admin requirement from rename_project
  if (!isAdmin(currentUser)) {
    return errorResponse(403, "Admin access required.");
  }

  if (project.name.toLowerCase() !== nextName.toLowerCase()) {
    const conflict = await findProject(sql, clientName, nextName, accountId);
    if (conflict) {
      return errorResponse(409, "That project already exists for this client.");
    }
  }

  await sql`
    UPDATE projects
    SET name = ${nextName},
        budget_amount = ${nextBudget},
        updated_at = NOW()
    WHERE id = ${project.id}
      AND account_id = ${accountId}::uuid
  `;

  if (project.name.toLowerCase() !== nextName.toLowerCase()) {
    await sql`
      UPDATE entries
      SET project_name = ${nextName}
      WHERE LOWER(client_name) = LOWER(${clientName})
        AND LOWER(project_name) = LOWER(${project.name})
        AND account_id = ${accountId}::uuid
    `;
  }

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

  const projectCountRows = await sql`
    SELECT COUNT(*)::INT AS total
    FROM projects
    WHERE client_id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;
  const projectCount = projectCountRows[0]?.total || 0;

  await sql`DELETE FROM clients WHERE id = ${client.id}`;

  const message =
    hoursLogged > 0 || projectCount > 0
      ? `${client.name} already has ${hoursLogged.toFixed(2)} logged hours and ${projectCount} active projects. Removing it will also remove the active projects. Remove it from the active catalog and keep the history?`
      : "";

  return { message };
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
  const targetGroup = permissionGroupForUser(targetUser.level);

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
    if (targetUser.id !== currentUser.id && targetGroup !== "staff") {
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

  if (targetGroup === "staff") {
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
      billable,
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
        (existing.notes || "") === (entry.notes || "") &&
        Boolean(existing.billable) === (entry.billable === false ? false : true)
      )
    : true;

  const status = hasContentChanges
    ? "pending"
    : persistedStatus
      ? normalizeStatus(persistedStatus)
      : "pending";
  const approvedAt = status === "approved" && !hasContentChanges ? existing?.approved_at : null;
  const approvedBy = status === "approved" && !hasContentChanges ? existing?.approved_by_user_id : null;
  const createdAt = entry.createdAt
    ? normalizeText(entry.createdAt)
    : existing?.created_at || new Date().toISOString();
  const updatedAt = entry.updatedAt
    ? normalizeText(entry.updatedAt)
    : new Date().toISOString();

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
      billable,
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
      ${entry.billable === false ? false : true},
      ${status},
      ${approvedAt},
      ${approvedBy},
      ${accountId},
      ${createdAt},
      ${updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      entry_date = EXCLUDED.entry_date,
      client_name = EXCLUDED.client_name,
      project_name = EXCLUDED.project_name,
      task = EXCLUDED.task,
      hours = EXCLUDED.hours,
      notes = EXCLUDED.notes,
      billable = EXCLUDED.billable,
      status = EXCLUDED.status,
      approved_at = EXCLUDED.approved_at,
      approved_by_user_id = EXCLUDED.approved_by_user_id,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;

  const beforeSnapshot = existing
    ? entrySnapshot({
        date: normalizeDateString(existing.entry_date) || normalizeText(entry.date),
        userId: targetUser?.id || null,
        clientId: project?.client_id || null,
        projectId: project?.id || null,
        hours: existing.hours,
        notes: existing.notes,
        nonbillable: existing.billable === false || existing.billable === 0,
        status: existing.status,
      })
    : null;
  const afterSnapshot = entrySnapshot({
    date: normalizeText(entry.date),
    userId: targetUser?.id || null,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    hours: normalizeHours(entry.hours),
    notes: normalizeText(entry.notes),
    nonbillable: entry.billable === false,
    status,
  });

  await logAudit(sql, {
    accountId,
    entityType: "time_entry",
    entityId: normalizeText(entry.id),
    action: existing ? "update" : "create",
    changedByUserId: currentUser?.id || null,
    changedByNameSnapshot: currentUser?.displayName || "",
    targetUserId: targetUser?.id || null,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: afterSnapshot,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, afterSnapshot || {}),
  });

  if (!existing) {
    const managerRecipientUserIds = await listManagerRecipientUserIds(sql, {
      accountId,
      clientId: project?.client_id || null,
      projectId: project?.id || null,
    });
    const recipients = managerRecipientUserIds.filter((userId) => userId !== currentUser?.id);
    await createSystemInboxItems(sql, {
      accountId,
      type: "time_entry_created",
      recipientUserIds: recipients,
      actorUserId: currentUser?.id || null,
      subjectType: "time",
      subjectId: normalizeText(entry.id),
      projectName: normalizeText(entry.project),
      message: buildInboxMessage("time_entry_created", {
        actorName: currentUser?.displayName || "",
        clientName: normalizeText(entry.client),
        projectName: normalizeText(entry.project),
        date: normalizeText(entry.date),
        hours: normalizeHours(entry.hours),
      }),
      deepLink: {
        view: "entries",
        subtab: "time",
        subjectId: normalizeText(entry.id),
      },
    });
  }

  return null;
}

async function approveEntry(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Entry id is required.");
  }
  if (!currentUser || permissionGroupForUser(currentUser.level) === "staff") {
    return errorResponse(403, "Manager access required.");
  }

  const rows = await sql`
    SELECT
      id,
      user_name AS user_name,
      client_name AS client_name,
      project_name AS project_name,
      entry_date,
      hours,
      notes,
      billable,
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

  const currentGroup = permissionGroupForUser(currentUser.level);
  const targetGroup = permissionGroupForUser(targetUser.level);
  const isCurrentAdmin = isAdmin(currentUser);

  if (!isCurrentAdmin) {
    if (currentUser.displayName === targetUser.display_name) {
      return errorResponse(403, "You cannot approve your own entries.");
    }
    if (currentGroup === "manager" && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only approve staff entries.");
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

  const beforeSnapshot = entrySnapshot({
    date: entry.entry_date,
    userId: targetUser?.id || null,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    hours: entry.hours,
    notes: entry.notes,
    nonbillable: entry.billable === false,
    status: entry.status,
  });
  const afterSnapshot = { ...beforeSnapshot, status: "approved" };

  await sql`
    UPDATE entries
    SET status = 'approved',
        approved_at = NOW(),
        approved_by_user_id = ${currentUser.id},
        updated_at = NOW()
    WHERE id = ${entry.id}
      AND account_id = ${accountId}::uuid
  `;

  await logAudit(sql, {
    accountId,
    entityType: "time_entry",
    entityId: entry.id,
    action: "approve",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: targetUser?.id || null,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: afterSnapshot,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, afterSnapshot || {}),
  });

  await createSystemInboxItems(sql, {
    accountId,
    type: "entry_approved",
    recipientUserIds: targetUser?.id ? [targetUser.id] : [],
    actorUserId: currentUser?.id || null,
    subjectType: "time",
    subjectId: entry.id,
    projectName: entry.project_name || "",
    message: buildInboxMessage("entry_approved", {
      actorName: currentUser?.displayName || "",
      clientName: entry.client_name || "",
      projectName: entry.project_name || "",
      date: normalizeDateString(entry.entry_date),
    }),
    deepLink: {
      view: "entries",
      subtab: "time",
      subjectId: entry.id,
    },
  });

  return null;
}

async function unapproveEntry(sql, payload, currentUser, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Entry id is required.");
  }
  if (!currentUser || permissionGroupForUser(currentUser.level) === "staff") {
    return errorResponse(403, "Manager access required.");
  }

  const rows = await sql`
    SELECT
      id,
      user_name AS user_name,
      client_name AS client_name,
      project_name AS project_name,
      entry_date,
      hours,
      notes,
      billable,
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

  const currentGroup = permissionGroupForUser(currentUser.level);
  const targetGroup = permissionGroupForUser(targetUser.level);
  const isCurrentAdmin = isAdmin(currentUser);

  if (!isCurrentAdmin) {
    if (currentUser.displayName === targetUser.display_name) {
      return errorResponse(403, "You cannot unapprove your own entries.");
    }
    if (currentGroup === "manager" && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only unapprove staff entries.");
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

  const beforeSnapshot = entrySnapshot({
    date: entry.entry_date,
    userId: targetUser?.id || null,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    hours: entry.hours,
    notes: entry.notes,
    nonbillable: entry.billable === false,
    status: entry.status,
  });
  const afterSnapshot = { ...beforeSnapshot, status: "pending" };

  await sql`
    UPDATE entries
    SET status = 'pending',
        approved_at = NULL,
        approved_by_user_id = NULL,
        updated_at = NOW()
    WHERE id = ${entry.id}
      AND account_id = ${accountId}::uuid
  `;

  await logAudit(sql, {
    accountId,
    entityType: "time_entry",
    entityId: entry.id,
    action: "unapprove",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: targetUser?.id || null,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: afterSnapshot,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, afterSnapshot || {}),
  });

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
      project_name AS project,
      entry_date,
      hours,
      notes,
      billable,
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
    const targetGroup = permissionGroupForUser(targetUser);
    if (targetUser && targetUser.id !== currentUser.id && targetGroup !== "staff") {
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

  const entryUser = await findUserByDisplayName(sql, entry.user, accountId);
  const beforeSnapshot = entrySnapshot({
    date: entry.entry_date || entry.date,
    userId: entryUser?.id || null,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    hours: entry.hours,
    notes: entry.notes,
    nonbillable: entry.billable === false,
    status: entry.status,
  });

  await sql`DELETE FROM entries WHERE id = ${id}`;

  await logAudit(sql, {
    accountId,
    entityType: "time_entry",
    entityId: id,
    action: "delete",
    changedByUserId: currentUser.id,
    changedByNameSnapshot: currentUser.displayName,
    targetUserId: entryUser?.id || null,
    contextClientId: project?.client_id || null,
    contextProjectId: project?.id || null,
    beforeJson: beforeSnapshot,
    afterJson: null,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, {}),
  });
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
    if (request.action === "complete_password_setup") {
      const setupResult = await completePasswordSetup(sql, request.payload || {});
      if (setupResult?.statusCode) {
        return setupResult;
      }
      return json(200, {
        success: true,
        sessionToken: setupResult?.sessionToken || null,
      });
    }
    const context = await getSessionContext(sql, event, request);
    const authError = requireAuth(context);
    if (authError) {
      return authError;
    }
    const accountId = context.currentUser?.accountId;
    const permissionRows = await permissions.loadPermissionsFromDb(sql);
    const permissionIndex = permissions.buildIndex({ permissions: permissionRows });
    const can = (capabilityKey, ctx = {}) =>
      permissions.can(context.currentUser, capabilityKey, {
        permissionIndex,
        actorOfficeId: context.currentUser?.officeId ?? null,
        actorUserId: context.currentUser?.id ?? null,
        ...ctx,
      });
    requestLevelLabels = await listLevelLabels(sql, accountId);

    let mutationResult = null;

    switch (request.action) {
      case "add_client": {
        const targetOfficeId =
          normalizeText(request.payload?.officeId) ||
          normalizeText(request.payload?.office_id) ||
          null;
        if (!can("create_client", { resourceOfficeId: targetOfficeId })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await addClient(sql, request.payload || {}, accountId);
        break;
      }
      case "add_project": {
        if (!isAdmin(context.currentUser) && !isExecutive(context.currentUser)) {
          return errorResponse(403, "Executive or Admin access required.");
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
        const targetClient = await findClient(sql, request.payload?.clientName, accountId);
        if (!targetClient) {
          return errorResponse(404, "Client not found.");
        }
        const projectIds = await collectUserProjectIdsForClient(
          sql,
          context.currentUser,
          targetClient.id,
          accountId
        );
        const canRename = can("edit_client", {
          resourceOfficeId: targetClient.office_id || null,
          projectId: projectIds[0] || null,
          actorProjectIds: projectIds,
        });
        if (!canRename) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await renameClient(sql, request.payload || {}, accountId);
        break;
      }
      case "update_client": {
        const targetClient = await findClient(sql, request.payload?.clientName, accountId);
        if (!targetClient) {
          return errorResponse(404, "Client not found.");
        }
        const projectIds = await collectUserProjectIdsForClient(
          sql,
          context.currentUser,
          targetClient.id,
          accountId
        );
        const canEdit = can("edit_client", {
          resourceOfficeId: targetClient.office_id || null,
          projectId: projectIds[0] || null,
          actorProjectIds: projectIds,
        });
        if (!canEdit) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await updateClient(sql, request.payload || {}, accountId);
        break;
      }
      case "rename_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await renameProject(sql, request.payload || {}, accountId);
        break;
      }
      case "update_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        mutationResult = await updateProject(sql, request.payload || {}, context.currentUser, accountId);
        break;
      }
      case "create_department": {
        if (!can("manage_departments")) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await createDepartment(sql, request.payload || {}, accountId);
        break;
      }
      case "rename_department": {
        if (!can("manage_departments")) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await renameDepartment(sql, request.payload || {}, accountId);
        break;
      }
      case "set_department_active": {
        if (!can("manage_departments")) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await setDepartmentActive(sql, request.payload || {}, accountId);
        break;
      }
      case "set_user_department": {
        const targetUserId = normalizeText(request.payload?.userId);
        if (!targetUserId) {
          return errorResponse(400, "User id is required.");
        }
        const targetUser = await findUserById(sql, targetUserId, accountId);
        if (!targetUser) {
          return errorResponse(404, "User not found.");
        }
        const canEditDept = can("edit_member_profile", {
          targetUserId,
          targetOfficeId: targetUser.office_id || targetUser.officeId || null,
        });
        if (!canEditDept) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await setUserDepartment(sql, request.payload || {}, accountId);
        break;
      }
      case "set_user_level": {
        const targetUserId = normalizeText(request.payload?.userId);
        if (!targetUserId) {
          return errorResponse(400, "User id is required.");
        }
        const targetUser = await findUserById(sql, targetUserId, accountId);
        if (!targetUser) {
          return errorResponse(404, "User not found.");
        }
        const canEditProfile = can("edit_member_profile", {
          targetUserId,
          targetOfficeId: targetUser.office_id || targetUser.officeId || null,
        });
        if (!canEditProfile) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await setUserLevel(sql, request.payload || {}, accountId);
        break;
      }
      case "update_role_permissions": {
        if (!can("manage_settings_access", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        const items = Array.isArray(request.payload?.rolePermissions)
          ? request.payload.rolePermissions
          : [];

        const normalized = items
          .map((item) => ({
            role: normalizeText(item?.role || item?.role_key),
            capability: normalizeText(item?.capability || item?.capability_key),
            allowed: !!item?.allowed,
          }))
          .filter((item) => item.role && item.capability);

        // Do not allow superuser permissions to be modified through this matrix.
        const filtered = normalized.filter((item) => item.role !== "superuser");

        const allowedPairs = filtered.filter((item) => item.allowed);

        const roleKeysAll = Array.from(new Set(filtered.map((i) => i.role)));
        const capKeysAll = Array.from(new Set(filtered.map((i) => i.capability)));

        const roles = roleKeysAll.length
          ? await sql`
              SELECT id, key
              FROM permission_roles
              WHERE key = ANY(${roleKeysAll})
            `
          : [];
        const caps = capKeysAll.length
          ? await sql`
              SELECT id, key
              FROM permission_capabilities
              WHERE key = ANY(${capKeysAll})
            `
          : [];
        const scopes = await sql`
          SELECT id
          FROM permission_scopes
          WHERE key = 'own_office'
          LIMIT 1
        `;
        const scopeId = scopes[0]?.id;
        if (!scopeId) {
          return errorResponse(500, "Scope not configured.");
        }
        const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));
        const capIdByKey = new Map(caps.map((c) => [c.key, c.id]));

        // Upsert allowed pairs
        for (const { role, capability } of allowedPairs) {
          const roleId = roleIdByKey.get(role);
          const capId = capIdByKey.get(capability);
          if (!roleId || !capId) continue;
          await sql`
            INSERT INTO role_permissions (role_id, capability_id, scope_id, allowed)
            VALUES (${roleId}, ${capId}, ${scopeId}, TRUE)
            ON CONFLICT (role_id, capability_id, scope_id) DO UPDATE SET allowed = EXCLUDED.allowed
          `;
        }

        // Remove disallowed pairs in this matrix (own_office scope only)
        if (roleKeysAll.length && capKeysAll.length) {
          const keepPairs = new Set(allowedPairs.map((p) => `${p.role}|${p.capability}`));
          const rows = await sql`
            SELECT rp.id, pr.key AS role_key, pc.key AS capability_key
            FROM role_permissions rp
            JOIN permission_roles pr ON pr.id = rp.role_id
            JOIN permission_capabilities pc ON pc.id = rp.capability_id
            WHERE rp.scope_id = ${scopeId}
              AND pr.key = ANY(${roleKeysAll})
              AND pc.key = ANY(${capKeysAll})
          `;
          for (const row of rows) {
            const key = `${row.role_key}|${row.capability_key}`;
            if (!keepPairs.has(key)) {
              await sql`DELETE FROM role_permissions WHERE id = ${row.id}`;
            }
          }
        }

        mutationResult = await loadState(sql, context.currentUser);
        break;
      }
      case "remove_client": {
        const targetClient = await findClient(sql, request.payload?.clientName, accountId);
        if (!targetClient) {
          return errorResponse(404, "Client not found.");
        }
        if (
          !can("archive_client", {
            resourceOfficeId: targetClient.office_id || null,
          })
        ) {
          return errorResponse(403, "Access denied.");
        }
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
      case "update_user_rates": {
        const userId = normalizeText(request.payload?.userId);
        const baseRateRaw = request.payload?.baseRate;
        const costRateRaw = request.payload?.costRate;
        if (!userId) {
          return errorResponse(400, "User id is required.");
        }
        const targetUser = await findUserById(sql, userId, accountId);
        if (!targetUser) {
          return errorResponse(404, "User not found.");
        }
        const canEditRates = can("edit_member_rates", {
          targetUserId: userId,
          targetOfficeId: targetUser.office_id || targetUser.officeId || null,
        });
        if (!canEditRates) {
          return errorResponse(403, "Access denied.");
        }
        const baseRate =
          baseRateRaw === null || baseRateRaw === undefined || baseRateRaw === ""
            ? null
            : Number(baseRateRaw);
        const costRate =
          costRateRaw === null || costRateRaw === undefined || costRateRaw === ""
            ? null
            : Number(costRateRaw);
        if (
          (baseRate !== null && (!Number.isFinite(baseRate) || baseRate < 0)) ||
          (costRate !== null && (!Number.isFinite(costRate) || costRate < 0))
        ) {
          return errorResponse(400, "Rates must be non-negative numbers.");
        }
        const now = new Date().toISOString();
        const result = await sql`
          UPDATE users
          SET base_rate = ${baseRate}, cost_rate = ${costRate}, updated_at = ${now}
          WHERE id = ${userId}
            AND account_id = ${accountId}::uuid
          RETURNING id
        `;
        if (!result[0]) {
          return errorResponse(404, "User not found.");
        }
        mutationResult = await loadState(sql, context.currentUser);
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
        if (!isAdmin(context.currentUser) && !isExecutive(context.currentUser)) {
          return errorResponse(403, "Executive or Admin access required.");
        }
        mutationResult = await assignManagerToClient(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "unassign_manager_client": {
        if (!isAdmin(context.currentUser) && !isExecutive(context.currentUser)) {
          return errorResponse(403, "Executive or Admin access required.");
        }
        mutationResult = await unassignManagerFromClient(
          sql,
          request.payload || {},
          accountId
        );
        break;
      }
      case "assign_manager_project": {
        if (!isAdmin(context.currentUser) && !isExecutive(context.currentUser)) {
          return errorResponse(403, "Executive or Admin access required.");
        }
        mutationResult = await assignManagerToProject(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "unassign_manager_project": {
        if (!isAdmin(context.currentUser) && !isExecutive(context.currentUser)) {
          return errorResponse(403, "Executive or Admin access required.");
        }
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
      case "create_expense": {
        mutationResult = await createExpense(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "update_expense": {
        mutationResult = await updateExpense(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "delete_expense": {
        mutationResult = await deleteExpense(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "toggle_expense_status": {
        mutationResult = await toggleExpenseStatus(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "mark_inbox_item_read": {
        mutationResult = await markInboxItemRead(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "delete_inbox_item": {
        mutationResult = await deleteInboxItem(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "delete_inbox_items": {
        mutationResult = await deleteInboxItems(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "delete_all_read_inbox_items": {
        mutationResult = await deleteAllReadInboxItems(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "add_user": {
        const desiredLevel = normalizeLevel(request.payload?.level ?? request.payload?.role);
        if (!requestLevelLabels?.[desiredLevel]) {
          return errorResponse(400, "Invalid level.");
        }
        const targetOfficeId =
          normalizeText(request.payload?.officeId) || normalizeText(request.payload?.office_id) || null;
        if (!can("create_member", { resourceOfficeId: targetOfficeId })) {
          return errorResponse(403, "Access denied.");
        }
        const level = desiredLevel;
        const createdUser = await createUserRecord(sql, {
          ...(request.payload || {}),
          level,
          accountId,
        });
        const setup = await createPasswordSetupToken(sql, {
          userId: createdUser.id,
          accountId,
        });
        const targetEmail = normalizeText(createdUser.email || request.payload?.email || "");
        if (!targetEmail || !targetEmail.includes("@")) {
          return errorResponse(400, "Member email is required for setup link.");
        }
        console.log("[add_user] setup token created", {
          userId: createdUser.id,
          email: targetEmail,
          expiresAt: setup.expiresAt,
        });
        await sendSetupEmail({
          to: targetEmail,
          username: createdUser.username,
          token: setup.token,
        });
        break;
      }
      case "update_user": {
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        const desiredLevel = normalizeLevel(request.payload?.level ?? request.payload?.role);
        if (!requestLevelLabels?.[desiredLevel]) {
          return errorResponse(400, "Invalid level.");
        }
        const nextLevel = desiredLevel;
        const nextOfficeId =
          request.payload?.officeId !== undefined && request.payload?.officeId !== null
            ? normalizeText(request.payload.officeId)
            : request.payload?.office_id !== undefined && request.payload?.office_id !== null
              ? normalizeText(request.payload.office_id)
              : target.office_id || target.officeId || null;
        if (!can("edit_member_profile", { resourceOfficeId: nextOfficeId })) {
          return errorResponse(403, "Access denied.");
        }
        const hasRateChange =
          request.payload?.baseRate !== undefined ||
          request.payload?.costRate !== undefined ||
          request.payload?.base_rate !== undefined ||
          request.payload?.cost_rate !== undefined;
        if (hasRateChange && !can("edit_member_rates", { resourceOfficeId: nextOfficeId })) {
          return errorResponse(403, "Access denied.");
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
      case "send_user_setup_link": {
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        const targetOfficeId = target.office_id || target.officeId || null;
        if (!can("admin_reset_password", { resourceOfficeId: targetOfficeId, targetUserId: target.id })) {
          return errorResponse(403, "Access denied.");
        }
        const email = normalizeText(target.email || "");
        if (!email || !email.includes("@")) {
          return errorResponse(400, "Member email is required for reset link.");
        }
        const setup = await createPasswordSetupToken(sql, {
          userId: target.id,
          accountId,
        });
        await sendSetupEmail({
          to: email,
          username: target.username,
          token: setup.token,
        });
        mutationResult = { ok: true };
        break;
      }
      case "reset_user_password": {
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        const targetOfficeId = target.office_id || target.officeId || null;
        if (!can("admin_reset_password", { resourceOfficeId: targetOfficeId, targetUserId: target.id })) {
          return errorResponse(403, "Access denied.");
        }
        await updateUserPassword(sql, request.payload || {}, accountId);
        break;
      }
      case "change_own_password": {
        mutationResult = await changeOwnPassword(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        break;
      }
      case "deactivate_user": {
        const target = await findUserById(sql, request.payload?.userId, accountId);
        if (!target || !target.is_active) {
          return errorResponse(404, "User not found.");
        }
        const targetOfficeId = target.office_id || target.officeId || null;
        if (!can("deactivate_member", { resourceOfficeId: targetOfficeId, targetUserId: target.id })) {
          return errorResponse(403, "Access denied.");
        }
        await deactivateUser(sql, request.payload || {}, context.currentUser);
        break;
      }
      case "update_level_labels": {
        if (!can("manage_levels", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await updateLevelLabels(sql, request.payload || {}, accountId);
        break;
      }
      case "update_expense_categories": {
        if (!can("manage_expense_categories", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await updateExpenseCategories(sql, request.payload || {}, accountId);
        break;
      }
      case "update_office_locations": {
        if (!can("manage_office_locations", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await updateOfficeLocations(sql, request.payload || {}, accountId);
        break;
      }
      case "list_audit_logs": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const logs = await listAuditLogs(sql, accountId, request.payload?.filters || {});
        return json(200, { auditLogs: logs });
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
