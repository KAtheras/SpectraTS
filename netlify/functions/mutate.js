"use strict";
const crypto = require("crypto");

const {
  createSession,
  createUserRecord,
  createPasswordSetupToken,
  deactivateUser,
  ensureSchema,
  ensureNotificationRulesForAccount,
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
  getProjectMemberBudgets,
  upsertProjectMemberBudget,
  deleteProjectMemberBudget,
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
  dispatchNotificationEvent,
} = require("./_inbox");

function hashSetupToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const DELEGATION_CAPABILITIES = new Set([
  "enter_time_on_behalf",
  "enter_expenses_on_behalf",
  "view_time_on_behalf",
  "view_expenses_on_behalf",
  "view_reports_on_behalf",
  "create_reports_on_behalf",
  "print_reports_on_behalf",
]);

function normalizeDelegationCapability(value) {
  const capability = normalizeText(value);
  return DELEGATION_CAPABILITIES.has(capability) ? capability : "";
}

async function hasDelegationCapability(
  sql,
  { accountId, delegatorUserId, delegateUserId, capability }
) {
  const rows = await sql`
    SELECT id
    FROM delegations
    WHERE account_id = ${accountId}::uuid
      AND delegator_user_id = ${delegatorUserId}
      AND delegate_user_id = ${delegateUserId}
      AND capability = ${capability}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

async function resolveActingAsOwner(
  sql,
  { payload, currentUser, accountId, requiredCapability }
) {
  const actingAsUserId = normalizeText(payload?.actingAsUserId) || currentUser.id;
  if (actingAsUserId === currentUser.id) {
    return { ownerUser: currentUser, isDelegated: false };
  }

  const ownerUser = await findUserById(sql, actingAsUserId, accountId);
  if (!ownerUser) {
    return { error: errorResponse(404, "Delegator not found.") };
  }

  const hasCapability = await hasDelegationCapability(sql, {
    accountId,
    delegatorUserId: ownerUser.id,
    delegateUserId: currentUser.id,
    capability: requiredCapability,
  });
  if (!hasCapability) {
    return { error: errorResponse(403, "Access denied.") };
  }

  return { ownerUser, isDelegated: true };
}

async function validateSetupToken(sql, payload) {
  const token = normalizeText(payload?.token);
  if (!token) {
    return { valid: false };
  }
  const tokenHash = hashSetupToken(token);
  const rows = await sql`
    SELECT expires_at, used_at
    FROM password_setup_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const record = rows[0];
  if (!record) {
    return { valid: false };
  }
  if (record.used_at) {
    return { valid: false };
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return { valid: false };
  }
  return { valid: true };
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
  const nowIso = new Date().toISOString();
  const claimedRows = await sql`
    UPDATE password_setup_tokens
    SET used_at = ${nowIso}
    WHERE token_hash = ${tokenHash}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING id, user_id, account_id
  `;
  const claimed = claimedRows[0];
  if (!claimed) {
    const rows = await sql`
      SELECT expires_at, used_at
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
    return errorResponse(400, "Invalid setup token.");
  }

  const updatedUsers = await sql`
    UPDATE users
    SET
      password_hash = ${hashPassword(password)},
      must_change_password = FALSE,
      updated_at = ${nowIso}
    WHERE id = ${claimed.user_id}
      AND account_id = ${claimed.account_id}::uuid
    RETURNING id
  `;
  if (!updatedUsers[0]) {
    await sql`
      UPDATE password_setup_tokens
      SET used_at = NULL
      WHERE id = ${claimed.id}
    `;
    return errorResponse(400, "Invalid setup token.");
  }

  const session = await createSession(sql, claimed.user_id);
  return { ok: true, sessionToken: session?.token || null };
}

async function sendSetupEmail({ to, username, token }) {
  const { sendEmail } = require("./send-email");
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
    endpoint: "internal sendEmail()",
  });
  if (typeof sendEmail !== "function") {
    throw new Error("sendEmail helper is unavailable");
  }
  let result;
  try {
    result = await sendEmail({ to, subject, html });
  } catch (error) {
    console.error("[add_user] send-email invocation failed", {
      to,
      username,
      error: error?.message || String(error),
    });
    throw error;
  }
  console.log("[add_user] send-email result", {
    id: result?.id || null,
    data: result || null,
  });
  if (!result || !result.id) {
    throw new Error("Unable to send setup email.");
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
    INSERT INTO departments (id, account_id, name, created_at, updated_at)
    VALUES (${id}, ${accountId}::uuid, ${name}, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;
  return { id, name };
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
    RETURNING id, name
  `;
  if (!result[0]) {
    return errorResponse(404, "Department not found.");
  }
  return result[0];
}

async function deleteDepartment(sql, payload, accountId) {
  const id = normalizeText(payload.id);
  if (!id) {
    return errorResponse(400, "Department id is required.");
  }
  const result = await sql`
    DELETE FROM departments
    WHERE id = ${id}
      AND account_id = ${accountId}::uuid
    RETURNING id
  `;
  if (!result[0]) {
    return errorResponse(404, "Department not found.");
  }
  return null;
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
      LIMIT 1
    `;
    if (!dept[0]) {
      return errorResponse(404, "Department not found.");
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

async function createDelegation(sql, payload, accountId) {
  const delegatorUserId = normalizeText(payload?.delegatorUserId);
  const delegateUserId = normalizeText(payload?.delegateUserId);
  const capability = normalizeDelegationCapability(payload?.capability);
  if (!delegatorUserId || !delegateUserId || !capability) {
    return errorResponse(400, "Delegator, delegate, and capability are required.");
  }
  if (delegatorUserId === delegateUserId) {
    return errorResponse(400, "Delegator and delegate must be different users.");
  }

  const [delegatorUser, delegateUser] = await Promise.all([
    findUserById(sql, delegatorUserId, accountId),
    findUserById(sql, delegateUserId, accountId),
  ]);
  if (!delegatorUser || !delegateUser) {
    return errorResponse(404, "User not found.");
  }

  const now = new Date().toISOString();
  await sql`
    INSERT INTO delegations (
      id,
      account_id,
      delegator_user_id,
      delegate_user_id,
      capability,
      created_at,
      updated_at
    )
    VALUES (
      ${randomId()},
      ${accountId}::uuid,
      ${delegatorUser.id},
      ${delegateUser.id},
      ${capability},
      ${now},
      ${now}
    )
    ON CONFLICT (account_id, delegator_user_id, delegate_user_id, capability)
    DO UPDATE SET
      updated_at = EXCLUDED.updated_at
  `;
  return null;
}

async function deleteDelegation(sql, payload, accountId) {
  const delegatorUserId = normalizeText(payload?.delegatorUserId);
  const delegateUserId = normalizeText(payload?.delegateUserId);
  const capability = normalizeDelegationCapability(payload?.capability);
  if (!delegatorUserId || !delegateUserId || !capability) {
    return errorResponse(400, "Delegator, delegate, and capability are required.");
  }

  await sql`
    DELETE FROM delegations
    WHERE account_id = ${accountId}::uuid
      AND delegator_user_id = ${delegatorUserId}
      AND delegate_user_id = ${delegateUserId}
      AND capability = ${capability}
  `;
  return null;
}

function normalizeDelegationCapabilityList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const caps = [];
  values.forEach((value) => {
    const capability = normalizeDelegationCapability(value);
    if (!capability || seen.has(capability)) return;
    seen.add(capability);
    caps.push(capability);
  });
  return caps;
}

async function listMyDelegations(sql, delegatorUserId, accountId) {
  const rows = await sql`
    SELECT
      d.delegate_user_id AS "delegateUserId",
      u.display_name AS "delegateName",
      d.capability
    FROM delegations d
    JOIN users u
      ON u.id = d.delegate_user_id
     AND u.account_id = d.account_id
    WHERE d.account_id = ${accountId}::uuid
      AND d.delegator_user_id = ${delegatorUserId}
    ORDER BY LOWER(u.display_name), d.capability
  `;
  return rows
    .map((row) => ({
      delegateUserId: `${row.delegateUserId || ""}`.trim(),
      delegateName: `${row.delegateName || ""}`.trim(),
      capability: `${row.capability || ""}`.trim(),
    }))
    .filter(
      (row) =>
        row.delegateUserId &&
        row.delegateName &&
        DELEGATION_CAPABILITIES.has(row.capability)
    );
}

async function saveDelegateCapabilities(sql, payload, accountId) {
  const delegatorUserId = normalizeText(payload?.delegatorUserId);
  const delegateUserId = normalizeText(payload?.delegateUserId);
  const selectedCapabilities = normalizeDelegationCapabilityList(payload?.capabilities);
  if (!delegatorUserId || !delegateUserId) {
    return errorResponse(400, "Delegator and delegate are required.");
  }
  if (delegatorUserId === delegateUserId) {
    return errorResponse(400, "Delegator and delegate must be different users.");
  }

  const [delegatorUser, delegateUser] = await Promise.all([
    findUserById(sql, delegatorUserId, accountId),
    findUserById(sql, delegateUserId, accountId),
  ]);
  if (!delegatorUser || !delegateUser) {
    return errorResponse(404, "User not found.");
  }

  const existingRows = await sql`
    SELECT capability
    FROM delegations
    WHERE account_id = ${accountId}::uuid
      AND delegator_user_id = ${delegatorUser.id}
      AND delegate_user_id = ${delegateUser.id}
  `;
  const existingSet = new Set(
    existingRows
      .map((row) => normalizeDelegationCapability(row.capability))
      .filter(Boolean)
  );
  const selectedSet = new Set(selectedCapabilities);

  const capabilitiesToCreate = selectedCapabilities.filter((capability) => !existingSet.has(capability));
  const capabilitiesToDelete = Array.from(existingSet).filter(
    (capability) => !selectedSet.has(capability)
  );

  const now = new Date().toISOString();
  for (const capability of capabilitiesToCreate) {
    await sql`
      INSERT INTO delegations (
        id,
        account_id,
        delegator_user_id,
        delegate_user_id,
        capability,
        created_at,
        updated_at
      )
      VALUES (
        ${randomId()},
        ${accountId}::uuid,
        ${delegatorUser.id},
        ${delegateUser.id},
        ${capability},
        ${now},
        ${now}
      )
      ON CONFLICT (account_id, delegator_user_id, delegate_user_id, capability)
      DO UPDATE SET
        updated_at = EXCLUDED.updated_at
    `;
  }
  if (capabilitiesToDelete.length) {
    await sql`
      DELETE FROM delegations
      WHERE account_id = ${accountId}::uuid
        AND delegator_user_id = ${delegatorUser.id}
        AND delegate_user_id = ${delegateUser.id}
        AND capability = ANY(${capabilitiesToDelete})
    `;
  }

  if (capabilitiesToCreate.length || capabilitiesToDelete.length) {
    await dispatchNotificationEvent(sql, {
      accountId,
      type: "delegation_updated",
      actorUserId: delegatorUser.id,
      actorName: delegatorUser.display_name || delegatorUser.displayName || "Someone",
      delegateUserId: delegateUser.id,
      subjectType: "delegation",
      subjectId: delegateUser.id,
      message: buildInboxMessage("delegation_updated", {
        actorName: delegatorUser.display_name || delegatorUser.displayName || "Someone",
      }),
    });
  }

  return {
    delegateUserId: delegateUser.id,
    capabilities: selectedCapabilities,
    myDelegations: await listMyDelegations(sql, delegatorUser.id, accountId),
  };
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
  const chargeCenterId = normalizeText(expense.chargeCenterId || expense.charge_center_id);
  const hasProjectPath = normalizeText(expense.clientName) && normalizeText(expense.projectName);
  if (!chargeCenterId && !hasProjectPath) {
    return "Client / Project or Corporate Function is required.";
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

async function markInboxItemsRead(sql, payload, currentUser, accountId) {
  const ids = Array.isArray(payload?.ids)
    ? Array.from(new Set(payload.ids.map((id) => normalizeText(id)).filter(Boolean)))
    : [];
  if (!ids.length) {
    return errorResponse(400, "At least one inbox item id is required.");
  }
  for (const id of ids) {
    await sql`
      UPDATE inbox_items
      SET is_read = TRUE
      WHERE id = ${id}
        AND account_id = ${accountId}::uuid
        AND recipient_user_id = ${currentUser.id}
        AND is_deleted = FALSE
    `;
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

async function updateNotificationRule(sql, payload, accountId) {
  const eventType = normalizeText(payload?.eventType);
  const supportedEvents = new Set([
    "time_entry_created",
    "expense_entry_created",
    "entry_approved",
    "expense_approved",
    "delegation_updated",
    "project_assignment_updated",
    "entry_billing_status_updated",
    "expense_billing_status_updated",
  ]);
  if (!eventType || !supportedEvents.has(eventType)) {
    return errorResponse(400, "Unsupported notification event.");
  }
  const emailCapableEvents = new Set([
    "project_assignment_updated",
    "delegation_updated",
  ]);
  const hasInboxUpdate = payload?.inboxEnabled !== undefined;
  const hasEmailUpdate = payload?.emailEnabled !== undefined;
  if (!hasInboxUpdate && !hasEmailUpdate) {
    return errorResponse(400, "At least one notification channel must be provided.");
  }
  if (hasEmailUpdate && !emailCapableEvents.has(eventType)) {
    return errorResponse(400, "Email is not available for this notification event.");
  }
  const parseBoolean = (value) =>
    value === true || value === 1 || String(value || "").toLowerCase() === "true";

  const existingRows = await sql`
    SELECT inbox_enabled AS "inboxEnabled", email_enabled AS "emailEnabled"
    FROM notification_rules
    WHERE account_id = ${accountId}::uuid
      AND event_type = ${eventType}
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) {
    return errorResponse(404, "Notification rule not found.");
  }

  const inboxEnabled = hasInboxUpdate ? parseBoolean(payload?.inboxEnabled) : Boolean(existing.inboxEnabled);
  const emailEnabled = hasEmailUpdate ? parseBoolean(payload?.emailEnabled) : Boolean(existing.emailEnabled);

  const rows = await sql`
    UPDATE notification_rules
    SET
      inbox_enabled = ${inboxEnabled},
      email_enabled = ${emailEnabled},
      enabled = ${inboxEnabled || emailEnabled},
      updated_at = NOW()
    WHERE account_id = ${accountId}::uuid
      AND event_type = ${eventType}
    RETURNING event_type
  `;
  if (!rows[0]) {
    return errorResponse(404, "Notification rule not found.");
  }
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

async function logEntityAudit(
  sql,
  {
    accountId,
    context,
    entityType,
    entityId,
    action,
    beforeSnapshot,
    afterSnapshot,
    targetUserId = null,
    contextClientId = null,
    contextProjectId = null,
  }
) {
  await logAudit(sql, {
    accountId,
    entityType,
    entityId,
    action,
    changedByUserId: context?.currentUser?.id || null,
    changedByNameSnapshot: context?.currentUser?.displayName || "",
    targetUserId,
    contextClientId,
    contextProjectId,
    beforeJson: beforeSnapshot || null,
    afterJson: afterSnapshot || null,
    changedFieldsJson: diffKeys(beforeSnapshot || {}, afterSnapshot || {}),
  });
}

async function runMutationWithAudit({
  sql,
  accountId,
  context,
  entityType,
  entityId,
  action,
  runMutation,
  getBeforeSnapshot = null,
  getAfterSnapshot = null,
  getSnapshot = null,
  targetUserId = null,
  contextClientId = null,
  contextProjectId = null,
}) {
  const beforeSnapshot = getBeforeSnapshot
    ? await getBeforeSnapshot()
    : getSnapshot
      ? await getSnapshot()
      : null;
  const mutationResult = await runMutation();
  if (mutationResult?.statusCode) {
    return mutationResult;
  }
  const afterSnapshot = getAfterSnapshot
    ? await getAfterSnapshot(beforeSnapshot, mutationResult)
    : getSnapshot
      ? await getSnapshot()
      : null;
  await logEntityAudit(sql, {
    accountId,
    context,
    entityType,
    entityId,
    action,
    beforeSnapshot,
    afterSnapshot,
    targetUserId,
    contextClientId,
    contextProjectId,
  });
  return mutationResult;
}

async function snapshotDelegation(sql, accountId, delegatorUserId, delegateUserId) {
  if (!delegateUserId) {
    return {
      delegator_user_id: delegatorUserId || null,
      delegate_user_id: null,
      capabilities: [],
    };
  }
  const rows = await sql`
    SELECT capability
    FROM delegations
    WHERE account_id = ${accountId}::uuid
      AND delegator_user_id = ${delegatorUserId || ""}
      AND delegate_user_id = ${delegateUserId}
    ORDER BY capability
  `;
  return {
    delegator_user_id: delegatorUserId || null,
    delegate_user_id: delegateUserId || null,
    capabilities: (rows || [])
      .map((row) => normalizeText(row.capability))
      .filter(Boolean),
  };
}

async function snapshotLevelLabels(sql, accountId) {
  const rows = await sql`
    SELECT level, label, permission_group
    FROM level_labels
    WHERE account_id = ${accountId}::uuid
    ORDER BY level ASC
  `;
  return (rows || []).map((row) => ({
    level: Number(row.level),
    label: normalizeText(row.label),
    permission_group: normalizeText(row.permission_group) || "staff",
  }));
}

async function snapshotExpenseCategories(sql, accountId) {
  const rows = await sql`
    SELECT id, name
    FROM expense_categories
    WHERE account_uuid = ${accountId}::uuid
    ORDER BY LOWER(name), id
  `;
  return (rows || []).map((row) => ({
    id: normalizeText(row.id),
    name: normalizeText(row.name),
  }));
}

async function snapshotOfficeLocations(sql, accountId) {
  const rows = await sql`
    SELECT id, name, office_lead_user_id, is_active
    FROM office_locations
    WHERE account_id = ${accountId}::uuid
    ORDER BY LOWER(name), id
  `;
  return (rows || []).map((row) => ({
    id: normalizeText(row.id),
    name: normalizeText(row.name),
    office_lead_user_id: normalizeText(row.office_lead_user_id),
    is_active: row.is_active !== false,
  }));
}

async function snapshotCorporateFunctions(sql, accountId) {
  const groupRows = await sql`
    SELECT id, name, sort_order
    FROM corporate_function_groups
    WHERE account_id = ${accountId}::uuid
    ORDER BY sort_order ASC, LOWER(name), id
  `;
  const categoryRows = await sql`
    SELECT id, group_id, group_name, name, sort_order
    FROM corporate_function_categories
    WHERE account_id = ${accountId}::uuid
    ORDER BY sort_order ASC, LOWER(name), id
  `;
  return {
    groups: (groupRows || []).map((row) => ({
      id: normalizeText(row.id),
      name: normalizeText(row.name),
      sort_order: Number(row.sort_order) || 0,
    })),
    categories: (categoryRows || []).map((row) => ({
      id: normalizeText(row.id),
      group_id: normalizeText(row.group_id),
      group_name: normalizeText(row.group_name),
      name: normalizeText(row.name),
      sort_order: Number(row.sort_order) || 0,
    })),
  };
}

async function snapshotRolePermissions(sql, accountId) {
  const rows = await sql`
    SELECT
      pr.key AS role_key,
      pc.key AS capability_key,
      ps.key AS scope_key,
      rp.allowed AS allowed
    FROM role_permissions rp
    JOIN permission_roles pr ON pr.id = rp.role_id
    JOIN permission_capabilities pc ON pc.id = rp.capability_id
    JOIN permission_scopes ps ON ps.id = rp.scope_id
    WHERE rp.allowed = TRUE
      AND ps.key = 'own_office'
    ORDER BY pr.key, pc.key
  `;
  return (rows || []).map((row) => ({
    role_key: normalizeText(row.role_key),
    capability_key: normalizeText(row.capability_key),
    scope_key: normalizeText(row.scope_key),
    allowed: row.allowed === true,
  }));
}

async function snapshotClientById(sql, clientId, accountId) {
  if (!clientId) return null;
  const rows = await sql`
    SELECT
      id,
      name,
      office_id,
      client_lead_id,
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
      is_active
    FROM clients
    WHERE id = ${clientId}
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: normalizeText(row.name),
    office_id: normalizeText(row.office_id),
    client_lead_id: normalizeText(row.client_lead_id),
    business_contact_name: normalizeText(row.business_contact_name),
    business_contact_email: normalizeText(row.business_contact_email),
    business_contact_phone: normalizeText(row.business_contact_phone),
    billing_contact_name: normalizeText(row.billing_contact_name),
    billing_contact_email: normalizeText(row.billing_contact_email),
    billing_contact_phone: normalizeText(row.billing_contact_phone),
    address_street: normalizeText(row.address_street),
    address_city: normalizeText(row.address_city),
    address_state: normalizeText(row.address_state),
    address_postal: normalizeText(row.address_postal),
    is_active: row.is_active !== false,
  };
}

async function snapshotProjectById(sql, projectId, accountId) {
  if (!projectId) return null;
  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.client_id,
      p.office_id,
      p.project_lead_id,
      p.budget_amount,
      p.is_active,
      c.name AS client_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${projectId}
      AND p.account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: normalizeText(row.name),
    client_id: row.client_id || null,
    client_name: normalizeText(row.client_name),
    office_id: normalizeText(row.office_id),
    project_lead_id: normalizeText(row.project_lead_id),
    budget_amount: row.budget_amount !== null && row.budget_amount !== undefined ? Number(row.budget_amount) : null,
    is_active: row.is_active !== false,
  };
}

function buildPermissionsPayload(currentUser, permissionIndex) {
  const can = (capability, ctx = {}) =>
    permissions.can(currentUser, capability, {
      permissionIndex,
      actorOfficeId: currentUser?.officeId ?? null,
      actorUserId: currentUser?.id ?? null,
      ...ctx,
    });
  const canManageSettingsAccess = can("manage_settings_access");
  const permissionsPayload = {
    edit_user_department: can("edit_user_department"),
    view_settings_tab: false,
    view_members_page: can("view_members"),
    view_member_rates: can("view_member_rates"),
    edit_user_rates: can("edit_member_rates"),
    manage_levels: can("manage_levels"),
    manage_departments: can("manage_departments"),
    manage_expense_categories: can("manage_expense_categories"),
    manage_corporate_functions: can("manage_expense_categories"),
    manage_office_locations: can("manage_office_locations"),
    can_upload_data: can("can_upload_data"),
    manage_settings_access: canManageSettingsAccess,
    can_delegate: can("can_delegate"),
    create_user: can("create_member"),
    edit_user_profile: can("edit_member_profile"),
    reset_user_password: can("admin_reset_password"),
    deactivate_user: can("deactivate_member"),
    view_analytics: can("view_analytics"),
    view_audit_logs: can("view_audit_logs"),
    create_project: can("create_project"),
    remove_project: can("archive_project"),
    create_client: can("create_client"),
    edit_client: can("edit_client"),
    archive_client: can("archive_client"),
    assign_project_members: can("assign_project_staff"),
    assign_project_managers: can("assign_project_managers"),
    create_entry: can("create_time_entry"),
    approve_entry: can("approve_time"),
    view_entries: can("view_entries"),
    create_expense: can("create_expense"),
    update_expense: can("edit_expense"),
    toggle_expense_status: can("approve_expense"),
    view_expenses: can("view_expenses"),
    view_users: can("view_users"),
    view_clients: can("view_clients"),
    view_projects: can("view_projects"),
  };
  permissionsPayload.view_settings_tab = Boolean(
    permissionsPayload.view_members_page ||
    permissionsPayload.manage_levels ||
    permissionsPayload.manage_departments ||
    permissionsPayload.manage_expense_categories ||
    permissionsPayload.manage_corporate_functions ||
    permissionsPayload.manage_office_locations ||
    permissionsPayload.can_upload_data ||
    permissionsPayload.manage_settings_access ||
    permissionsPayload.can_delegate
  );
  return {
    permissions: permissionsPayload,
    canManageSettingsAccess,
  };
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
  delegatedAction,
  delegatedByUserId,
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
    ...(delegatedAction ? { delegated_action: true } : {}),
    ...(delegatedByUserId ? { delegated_by_user_id: delegatedByUserId } : {}),
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
  delegatedAction,
  delegatedByUserId,
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
    ...(delegatedAction ? { delegated_action: true } : {}),
    ...(delegatedByUserId ? { delegated_by_user_id: delegatedByUserId } : {}),
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
  const projectId = normalizeText(entry.projectId || entry.project_id);
  const chargeCenterId = normalizeText(entry.chargeCenterId || entry.charge_center_id);
  if (!projectId && !chargeCenterId) {
    return "Client / Project or Corporate Function is required.";
  }

  const hours = normalizeHours(entry.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return "Hours must be between 0 and 24.";
  }

  if (typeof entry.billable !== "boolean") {
    entry.billable = true;
  }
  if (chargeCenterId) {
    entry.billable = false;
  }

  return "";
}

async function findProjectById(sql, projectId, accountId) {
  const id = Number(projectId);
  if (!Number.isFinite(id)) return null;
  const rows = await sql`
    SELECT
      projects.id,
      projects.name,
      projects.client_id,
      clients.name AS client
    FROM projects
    JOIN clients ON clients.id = projects.client_id
    WHERE projects.id = ${id}
      AND projects.account_id = ${accountId}::uuid
    LIMIT 1
  `;
  return rows[0] || null;
}

async function findCorporateFunctionCategoryById(sql, categoryId, accountId) {
  const id = normalizeText(categoryId);
  if (!id) return null;
  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.group_id,
      COALESCE(g.name, c.group_name, 'Other') AS group_name
    FROM corporate_function_categories c
    LEFT JOIN corporate_function_groups g
      ON g.id = c.group_id
     AND g.account_id = c.account_id
    WHERE c.id = ${id}
      AND c.account_id = ${accountId}::uuid
    LIMIT 1
  `;
  return rows[0] || null;
}

function normalizeCorporateProjectLabel(groupName, categoryName, fallbackProjectName) {
  const group = normalizeText(groupName);
  const category = normalizeText(categoryName);
  const fallback = normalizeText(fallbackProjectName);
  if (group && category) return `${group} / ${category}`;
  return category || group || fallback || "Internal";
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
    if (!name) {
      return errorResponse(400, "Category name cannot be blank.");
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return errorResponse(400, "Category names must be unique.");
    }
    seen.add(key);
    cleaned.push({ id, name });
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
            created_at = COALESCE(created_at, ${now})
        WHERE id = ${item.id}
          AND account_uuid = ${accountId}::uuid
        RETURNING id
      `;
      if (!result[0]) {
        await sql`
          INSERT INTO expense_categories (id, account_uuid, name, created_at)
          VALUES (${item.id}, ${accountId}::uuid, ${item.name}, ${now})
        `;
      }
    } else {
      await sql`
        INSERT INTO expense_categories (id, account_uuid, name, created_at)
        VALUES (${randomId()}, ${accountId}::uuid, ${item.name}, ${now})
      `;
    }
  }

  return null;
}

async function updateCorporateFunctionCategories(sql, payload, accountId) {
  let groups = Array.isArray(payload?.groups) ? payload.groups : [];
  if (!groups.length && Array.isArray(payload?.categories)) {
    const grouped = new Map();
    (payload.categories || []).forEach((item) => {
      const groupName = normalizeText(item?.groupName || item?.group_name) || "Other";
      if (!grouped.has(groupName)) grouped.set(groupName, []);
      grouped.get(groupName).push({
        id: item?.id || null,
        name: item?.name || "",
        sortOrder: item?.sortOrder ?? item?.sort_order ?? null,
      });
    });
    let fallbackGroupOrder = 10;
    groups = Array.from(grouped.entries()).map(([name, categories]) => {
      const mapped = {
        id: null,
        name,
        sortOrder: fallbackGroupOrder,
        categories,
      };
      fallbackGroupOrder += 10;
      return mapped;
    });
  }
  const cleanedGroups = [];
  const groupNameSet = new Set();

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const groupItem = groups[groupIndex] || {};
    const id = normalizeText(groupItem?.id);
    const name = normalizeText(groupItem?.name);
    const parsedSortOrder = Number(groupItem?.sortOrder ?? groupItem?.sort_order);
    const sortOrder =
      Number.isFinite(parsedSortOrder) && parsedSortOrder >= 0
        ? Math.floor(parsedSortOrder)
        : (groupIndex + 1) * 10;
    if (!name) {
      return errorResponse(400, "Group name cannot be blank.");
    }
    const normalizedName = name.toLowerCase();
    if (groupNameSet.has(normalizedName)) {
      return errorResponse(400, "Group names must be unique.");
    }
    groupNameSet.add(normalizedName);
    const categories = Array.isArray(groupItem?.categories) ? groupItem.categories : [];
    const cleanedCategories = [];
    const categoryNameSet = new Set();
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
      const categoryItem = categories[categoryIndex] || {};
      const categoryId = normalizeText(categoryItem?.id);
      const categoryName = normalizeText(categoryItem?.name);
      if (!categoryName) {
        return errorResponse(400, `Category name cannot be blank in ${name}.`);
      }
      const normalizedCategoryName = categoryName.toLowerCase();
      if (categoryNameSet.has(normalizedCategoryName)) {
        return errorResponse(400, `Category names must be unique within ${name}.`);
      }
      categoryNameSet.add(normalizedCategoryName);
      const parsedCategorySort = Number(categoryItem?.sortOrder ?? categoryItem?.sort_order);
      const categorySortOrder =
        Number.isFinite(parsedCategorySort) && parsedCategorySort >= 0
          ? Math.floor(parsedCategorySort)
          : (categoryIndex + 1) * 10;
      cleanedCategories.push({
        id: categoryId,
        name: categoryName,
        sortOrder: categorySortOrder,
      });
    }
    cleanedGroups.push({ id, name, sortOrder, categories: cleanedCategories });
  }

  const existingGroups = await sql`
    SELECT id
    FROM corporate_function_groups
    WHERE account_id = ${accountId}::uuid
  `;
  const existingGroupIds = new Set(
    existingGroups.map((row) => `${row?.id || ""}`.trim()).filter(Boolean)
  );
  const keepGroupIds = new Set(
    cleanedGroups.map((group) => `${group?.id || ""}`.trim()).filter(Boolean)
  );

  const now = new Date().toISOString();
  const resolvedGroupIds = new Map();
  for (const group of cleanedGroups) {
    let groupId = `${group.id || ""}`.trim();
    if (groupId) {
      const updated = await sql`
        UPDATE corporate_function_groups
        SET
          name = ${group.name},
          sort_order = ${group.sortOrder},
          updated_at = ${now}
        WHERE account_id = ${accountId}::uuid
          AND id = ${groupId}
        RETURNING id
      `;
      if (!updated[0]) {
        groupId = randomId();
        await sql`
          INSERT INTO corporate_function_groups (id, account_id, name, sort_order, created_at, updated_at)
          VALUES (${groupId}, ${accountId}::uuid, ${group.name}, ${group.sortOrder}, ${now}, ${now})
        `;
      }
    } else {
      groupId = randomId();
      await sql`
        INSERT INTO corporate_function_groups (id, account_id, name, sort_order, created_at, updated_at)
        VALUES (${groupId}, ${accountId}::uuid, ${group.name}, ${group.sortOrder}, ${now}, ${now})
      `;
    }
    resolvedGroupIds.set(group, groupId);
    await sql`
      UPDATE corporate_function_categories
      SET group_name = ${group.name}
      WHERE account_id = ${accountId}::uuid
        AND group_id = ${groupId}
    `;
  }

  for (const group of cleanedGroups) {
    const groupId = resolvedGroupIds.get(group);
    const existingCategories = await sql`
      SELECT id
      FROM corporate_function_categories
      WHERE account_id = ${accountId}::uuid
        AND group_id = ${groupId}
    `;
    const keepCategoryIds = new Set(
      group.categories.map((category) => `${category?.id || ""}`.trim()).filter(Boolean)
    );
    for (const row of existingCategories) {
      const categoryId = `${row?.id || ""}`.trim();
      if (!categoryId || keepCategoryIds.has(categoryId)) {
        continue;
      }
      await sql`
        DELETE FROM corporate_function_categories
        WHERE account_id = ${accountId}::uuid
          AND id = ${categoryId}
      `;
    }

    for (const category of group.categories) {
      const categoryId = `${category.id || ""}`.trim();
      if (categoryId) {
        const updatedCategory = await sql`
          UPDATE corporate_function_categories
          SET
            group_id = ${groupId},
            name = ${category.name},
            sort_order = ${category.sortOrder},
            updated_at = ${now}
          WHERE account_id = ${accountId}::uuid
            AND id = ${categoryId}
          RETURNING id
        `;
        if (updatedCategory[0]) {
          continue;
        }
      }
      await sql`
        INSERT INTO corporate_function_categories (
          id,
          account_id,
          group_id,
          group_name,
          name,
          sort_order,
          created_at,
          updated_at
        )
        VALUES (
          ${categoryId || randomId()},
          ${accountId}::uuid,
          ${groupId},
          ${group.name},
          ${category.name},
          ${category.sortOrder},
          ${now},
          ${now}
        )
      `;
    }
  }

  for (const groupId of existingGroupIds) {
    if (!keepGroupIds.has(groupId)) {
      await sql`
        DELETE FROM corporate_function_groups
        WHERE account_id = ${accountId}::uuid
          AND id = ${groupId}
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
      const dependencyCounts = await sql`
        SELECT
          (SELECT COUNT(*)::INT
           FROM users
           WHERE account_id = ${accountId}::uuid
             AND is_active = TRUE
             AND office_id = ${existingRow.id}) AS "activeMembers",
          (SELECT COUNT(*)::INT
           FROM clients
           WHERE account_id = ${accountId}::uuid
             AND office_id = ${existingRow.id}) AS "activeClients",
          (SELECT COUNT(*)::INT
           FROM projects
           WHERE account_id = ${accountId}::uuid
             AND office_id = ${existingRow.id}) AS "activeProjects"
      `;
      const activeMembers = Number(dependencyCounts?.[0]?.activeMembers || 0);
      const activeClients = Number(dependencyCounts?.[0]?.activeClients || 0);
      const activeProjects = Number(dependencyCounts?.[0]?.activeProjects || 0);
      if (activeMembers > 0 || activeClients > 0 || activeProjects > 0) {
        return errorResponse(
          400,
          "Cannot Remove Office\n" +
            "This office still has active items assigned to it and cannot be removed.\n\n" +
            "Please reassign or remove all active:\n" +
            "- members\n" +
            "- clients\n" +
            "- projects\n\n" +
            `${activeMembers} active members\n` +
            `${activeClients} active clients\n` +
            `${activeProjects} active projects`
        );
      }
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
  const clientLeadId = clean(payload.clientLeadId ?? payload.client_lead_id);
  if (clientLeadId) {
    const lead = await findUserById(sql, clientLeadId, accountId);
    if (!lead) {
      return errorResponse(400, "Client lead not found.");
    }
  }

  if (await findClient(sql, clientName, accountId)) {
    return errorResponse(409, "That client already exists.");
  }

  const now = new Date().toISOString();
  const inserted = await sql`
    INSERT INTO clients (
      account_id,
      name,
      office_id,
      client_lead_id,
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
      ${clientLeadId},
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
  if (client.is_active === false) {
    return errorResponse(400, "Client is inactive.");
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
  const hasClientLeadIdField =
    Object.prototype.hasOwnProperty.call(payload || {}, "clientLeadId") ||
    Object.prototype.hasOwnProperty.call(payload || {}, "client_lead_id");
  const nextClientLeadId = hasClientLeadIdField
    ? clean(payload.clientLeadId ?? payload.client_lead_id)
    : client.client_lead_id || null;
  if (nextClientLeadId) {
    const lead = await findUserById(sql, nextClientLeadId, accountId);
    if (!lead) {
      return errorResponse(400, "Client lead not found.");
    }
  }

  await sql`
    UPDATE clients
    SET
      name = ${nextName},
      office_id = ${clean(payload.officeId)},
      client_lead_id = ${nextClientLeadId},
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
  const projectLeadId = normalizeText(payload.projectLeadId ?? payload.project_lead_id) || null;
  if (projectLeadId) {
    const lead = await findUserById(sql, projectLeadId, accountId);
    if (!lead) {
      return errorResponse(400, "Project lead not found.");
    }
  }

  await sql`
    INSERT INTO projects (client_id, account_id, office_id, project_lead_id, name, created_by)
    VALUES (
      ${client.id},
      ${accountId}::uuid,
      ${client.office_id || null},
      ${projectLeadId},
      ${projectName},
      ${currentUser?.id || null}
    )
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

  const existingMemberRows = await sql`
    SELECT id
    FROM project_members
    WHERE project_id = ${project.id}
      AND user_id = ${userId}
      AND (account_id = ${accountId}::uuid OR account_id IS NULL)
    LIMIT 1
  `;
  const wasAlreadyAssigned = Boolean(existingMemberRows[0]);

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
  if (!wasAlreadyAssigned) {
    await dispatchNotificationEvent(sql, {
      accountId,
      type: "project_assignment_updated",
      actorUserId: currentUser?.id || null,
      actorName: currentUser?.displayName || "",
      assignmentChange: "added",
      assignedUserId: userId,
      subjectType: "project_member",
      subjectId: `${project.id}:${userId}`,
      clientId: project.client_id || null,
      projectId: project.id,
      projectName: projectName,
      message: buildInboxMessage("project_assignment_updated", {
        actorName: currentUser?.displayName || "",
        clientName,
        projectName,
        assignmentChange: "added",
      }),
    });
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

  const deletedRows = await sql`
    DELETE FROM project_members
    WHERE project_id = ${project.id}
      AND user_id = ${userId}
      AND (account_id = ${accountId}::uuid OR account_id IS NULL)
    RETURNING user_id
  `;
  if (deletedRows[0]) {
    await dispatchNotificationEvent(sql, {
      accountId,
      type: "project_assignment_updated",
      actorUserId: currentUser?.id || null,
      actorName: currentUser?.displayName || "",
      assignmentChange: "removed",
      assignedUserId: userId,
      subjectType: "project_member",
      subjectId: `${project.id}:${userId}`,
      clientId: project.client_id || null,
      projectId: project.id,
      projectName: projectName,
      message: buildInboxMessage("project_assignment_updated", {
        actorName: currentUser?.displayName || "",
        clientName,
        projectName,
        assignmentChange: "removed",
      }),
    });
  }
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
  const isBulkUpload = normalizeText(payload?.source) === "bulk_upload";
  const actingContext = await resolveActingAsOwner(sql, {
    payload,
    currentUser,
    accountId,
    requiredCapability: "enter_expenses_on_behalf",
  });
  if (actingContext.error) {
    return actingContext.error;
  }
  const canActOnBehalf = actingContext.isDelegated;
  const payloadExpense = payload.expense || {};
  const requestedUserId = normalizeText(payloadExpense.userId || payloadExpense.user_id);
  const expense = {
    ...payloadExpense,
    userId: canActOnBehalf
      ? actingContext.ownerUser?.id || currentUser.id
      : requestedUserId || actingContext.ownerUser?.id || currentUser.id,
  };
  const validationError = validateExpense(expense);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const requestedChargeCenterId = normalizeText(expense.chargeCenterId || expense.charge_center_id);
  const corporateCategory = requestedChargeCenterId
    ? await findCorporateFunctionCategoryById(sql, requestedChargeCenterId, accountId)
    : null;
  let project = null;
  if (!corporateCategory) {
    project = await findProject(sql, expense.clientName, expense.projectName, accountId);
  }
  const isCorporateExpense =
    Boolean(corporateCategory) || normalizeText(expense.clientName).toLowerCase() === "internal";
  if (!project && !isCorporateExpense) {
    return errorResponse(404, "Project not found.");
  }
  if (corporateCategory) {
    expense.clientName = "Internal";
    expense.projectName = normalizeCorporateProjectLabel(
      corporateCategory.group_name,
      corporateCategory.name,
      expense.projectName
    );
  }

  const targetUser = await findUserById(sql, expense.userId, accountId);
  if (!targetUser) {
    return errorResponse(404, "Team member not found.");
  }
  const targetGroup = permissionGroupForUser(targetUser.level);

  if (isAdmin(currentUser)) {
    // full access
  } else if (isManager(currentUser)) {
    if (!isCorporateExpense) {
      const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
      if (!hasAccess) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    } else if (!canActOnBehalf && targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save your own internal expenses.");
    }
    if (!canActOnBehalf && targetUser.id !== currentUser.id && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only edit staff expenses.");
    }
  } else if (isStaff(currentUser)) {
    if (!canActOnBehalf && targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save expenses for your own account.");
    }
    if (!isCorporateExpense) {
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

  const now = new Date().toISOString();
  const id = normalizeText(expense.id) || randomId();
  const isBillable =
    isCorporateExpense || expense.isBillable === false || expense.isBillable === 0 ? 0 : 1;

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
    delegatedAction: canActOnBehalf,
    delegatedByUserId: canActOnBehalf ? currentUser?.id || null : null,
  });
  if (isBulkUpload) {
    afterSnapshot.bulkUpload = true;
  }

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

  await dispatchNotificationEvent(sql, {
    accountId,
    type: "expense_entry_created",
    actorUserId: currentUser?.id || null,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    entryOwnerUserId: targetUser?.id || null,
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
    noteSnippet: normalizeText(expense.notes),
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
    chargeCenterId: normalizeText(expense.chargeCenterId || expense.charge_center_id),
  };

  const validationError = validateExpense(safeExpense);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const previousProject = await findProject(sql, existing.client_name, existing.project_name, accountId);
  const corporateCategory = safeExpense.chargeCenterId
    ? await findCorporateFunctionCategoryById(sql, safeExpense.chargeCenterId, accountId)
    : null;
  let project = null;
  if (!corporateCategory) {
    project = await findProject(sql, safeExpense.clientName, safeExpense.projectName, accountId);
  }
  const isCorporateExpense =
    Boolean(corporateCategory) || normalizeText(safeExpense.clientName).toLowerCase() === "internal";
  if (!project && !isCorporateExpense) {
    return errorResponse(404, "Project not found.");
  }
  if (corporateCategory) {
    safeExpense.clientName = "Internal";
    safeExpense.projectName = normalizeCorporateProjectLabel(
      corporateCategory.group_name,
      corporateCategory.name,
      safeExpense.projectName
    );
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
    if (!isCorporateExpense) {
      const hasAccess = await managerHasProjectAccess(sql, currentUser.id, project.id, accountId);
      if (!hasAccess) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    } else if (targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save your own internal expenses.");
    }
    if (targetUser.id !== currentUser.id && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only edit staff expenses.");
    }
  } else if (isStaff(currentUser)) {
    if (targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save expenses for your own account.");
    }
    if (!isCorporateExpense) {
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

  const isBillable =
    isCorporateExpense || safeExpense.isBillable === false || safeExpense.isBillable === 0 ? 0 : 1;
  const previousBillable = existing.is_billable === 0 ? false : true;
  const nextBillable = isBillable === 0 ? false : true;
  const billableChanged = previousBillable !== nextBillable;
  const existingStatus = normalizeStatus(existing.status);
  const actorCanApprove = !isStaff(currentUser);
  const nextStatus =
    existingStatus === "approved" && billableChanged && !actorCanApprove
      ? "pending"
      : existing.status;
  const nextApprovedAt =
    normalizeStatus(nextStatus) === "approved" ? existing.approved_at : null;
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
    status: nextStatus,
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
      status = ${nextStatus},
      approved_at = ${nextApprovedAt},
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

  if (previousBillable !== nextBillable) {
    await dispatchNotificationEvent(sql, {
      accountId,
      type: "expense_billing_status_updated",
      actorUserId: currentUser?.id || null,
      expenseOwnerUserId: targetUser?.id || null,
      clientId: project?.client_id || null,
      projectId: project?.id || null,
      subjectType: "expense",
      subjectId: id,
      projectName: safeExpense.projectName,
      message: buildInboxMessage("expense_billing_status_updated", {
        actorName: currentUser?.displayName || "",
        clientName: safeExpense.clientName,
        projectName: safeExpense.projectName,
      }),
    });
  }

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

  if (nextStatus === "approved") {
    await dispatchNotificationEvent(sql, {
      accountId,
      type: "expense_approved",
      actorUserId: currentUser?.id || null,
      expenseOwnerUserId: targetUser?.id || null,
      clientId: project?.client_id || null,
      projectId: project?.id || null,
      subjectType: "expense",
      subjectId: expense.id,
      projectName: expense.project_name || "",
      message: buildInboxMessage("expense_approved", {
        actorName: currentUser?.displayName || "",
        clientName: expense.client_name || "",
        projectName: expense.project_name || "",
        date: normalizeDateString(expense.expense_date),
      }),
      noteSnippet: normalizeText(expense.notes),
      deepLink: {
        view: "entries",
        subtab: "expenses",
        subjectId: expense.id,
      },
    });
  }

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
  const hasProjectLeadField =
    Object.prototype.hasOwnProperty.call(payload || {}, "projectLeadId") ||
    Object.prototype.hasOwnProperty.call(payload || {}, "project_lead_id");

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
  const nextProjectLeadId = hasProjectLeadField
    ? normalizeText(payload.projectLeadId ?? payload.project_lead_id) || null
    : project.project_lead_id || null;
  if (nextProjectLeadId) {
    const lead = await findUserById(sql, nextProjectLeadId, accountId);
    if (!lead) {
      return errorResponse(400, "Project lead not found.");
    }
  }

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
        project_lead_id = ${nextProjectLeadId},
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

  const projectCountRows = await sql`
    SELECT COUNT(*)::INT AS total
    FROM projects
    WHERE client_id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;
  const activeProjectCount = projectCountRows[0]?.total || 0;
  if (activeProjectCount > 0) {
    return errorResponse(
      400,
      "Cannot Remove Client\n" +
        "This client still has active projects assigned to it and cannot be removed.\n\n" +
        "Please remove or reassign all active projects before deleting this client.\n\n" +
        `${activeProjectCount} active projects`
    );
  }

  await sql`DELETE FROM clients WHERE id = ${client.id}`;
  return { message: "" };
}

async function removeProject(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const assignedMembersRows = await sql`
    SELECT COUNT(DISTINCT member_id)::INT AS total
    FROM (
      SELECT project_members.user_id AS member_id
      FROM project_members
      JOIN users ON users.id = project_members.user_id
      WHERE project_members.project_id = ${project.id}
        AND project_members.account_id = ${accountId}::uuid
        AND users.account_id = ${accountId}::uuid
        AND users.is_active = TRUE
      UNION
      SELECT manager_projects.manager_id AS member_id
      FROM manager_projects
      JOIN users ON users.id = manager_projects.manager_id
      WHERE manager_projects.project_id = ${project.id}
        AND manager_projects.account_id = ${accountId}::uuid
        AND users.account_id = ${accountId}::uuid
        AND users.is_active = TRUE
    ) assigned_members
  `;
  const assignedActiveMembers = assignedMembersRows[0]?.total || 0;
  if (assignedActiveMembers > 0) {
    return errorResponse(
      400,
      "Cannot Remove Project\n" +
        "This project still has assigned active members and cannot be removed.\n\n" +
        "Please remove or reassign all assigned active members before deleting this project.\n\n" +
        `${assignedActiveMembers} assigned active members`
    );
  }

  await sql`DELETE FROM projects WHERE id = ${project.id}`;
  return { message: "" };
}

async function deactivateClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }

  const dependencyRows = await sql`
    SELECT COUNT(*)::INT AS total
    FROM projects
    WHERE client_id = ${client.id}
      AND account_id = ${accountId}::uuid
      AND is_active = TRUE
  `;
  const activeProjectCount = Number(dependencyRows?.[0]?.total || 0);
  if (activeProjectCount > 0) {
    return errorResponse(
      400,
      "Cannot Deactivate Client\n" +
        "This client still has active projects.\n\n" +
        "Please deactivate or remove all active projects before deactivating this client.\n\n" +
        `${activeProjectCount} active projects`
    );
  }

  await sql`
    UPDATE clients
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;
  return { message: "" };
}

async function reactivateClient(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const client = await findClient(sql, clientName, accountId);
  if (!client) {
    return errorResponse(404, "Client not found.");
  }
  await sql`
    UPDATE clients
    SET is_active = TRUE,
        updated_at = NOW()
    WHERE id = ${client.id}
      AND account_id = ${accountId}::uuid
  `;
  return { message: "" };
}

async function deactivateProject(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const assignedMembersRows = await sql`
    SELECT COUNT(DISTINCT member_id)::INT AS total
    FROM (
      SELECT project_members.user_id AS member_id
      FROM project_members
      JOIN users ON users.id = project_members.user_id
      WHERE project_members.project_id = ${project.id}
        AND project_members.account_id = ${accountId}::uuid
        AND users.account_id = ${accountId}::uuid
        AND users.is_active = TRUE
      UNION
      SELECT manager_projects.manager_id AS member_id
      FROM manager_projects
      JOIN users ON users.id = manager_projects.manager_id
      WHERE manager_projects.project_id = ${project.id}
        AND manager_projects.account_id = ${accountId}::uuid
        AND users.account_id = ${accountId}::uuid
        AND users.is_active = TRUE
    ) assigned_members
  `;
  const assignedActiveMembers = Number(assignedMembersRows?.[0]?.total || 0);
  if (assignedActiveMembers > 0) {
    return errorResponse(
      400,
      "Cannot Deactivate Project\n" +
        "This project still has assigned active members.\n\n" +
        "Please remove or reassign all assigned active members before deactivating this project.\n\n" +
        `${assignedActiveMembers} assigned active members`
    );
  }

  await sql`
    UPDATE projects
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE id = ${project.id}
      AND account_id = ${accountId}::uuid
  `;
  return { message: "" };
}

async function reactivateProject(sql, payload, accountId) {
  const clientName = normalizeText(payload.clientName);
  const projectName = normalizeText(payload.projectName);
  const project = await findProject(sql, clientName, projectName, accountId);
  if (!project) {
    return errorResponse(404, "Project not found.");
  }

  const clientRows = await sql`
    SELECT clients.is_active AS "isActive"
    FROM clients
    JOIN projects ON projects.client_id = clients.id
    WHERE projects.id = ${project.id}
      AND projects.account_id = ${accountId}::uuid
      AND clients.account_id = ${accountId}::uuid
    LIMIT 1
  `;
  const clientIsActive = Boolean(clientRows?.[0]?.isActive);
  if (!clientIsActive) {
    return errorResponse(
      400,
      "Cannot Reactivate Project\n" +
        "This project’s client is inactive.\n\n" +
        "Please reactivate the client before reactivating this project."
    );
  }

  await sql`
    UPDATE projects
    SET is_active = TRUE,
        updated_at = NOW()
    WHERE id = ${project.id}
      AND account_id = ${accountId}::uuid
  `;
  return { message: "" };
}

async function saveEntry(sql, payload, currentUser, accountId) {
  const isBulkUpload = normalizeText(payload?.source) === "bulk_upload";
  const actingContext = await resolveActingAsOwner(sql, {
    payload,
    currentUser,
    accountId,
    requiredCapability: "enter_time_on_behalf",
  });
  if (actingContext.error) {
    return actingContext.error;
  }
  const canActOnBehalf = actingContext.isDelegated;
  const payloadEntry = payload.entry || {};
  const requestedUserId = normalizeText(payloadEntry.userId);
  const requestedUserName = normalizeText(payloadEntry.user);
  const actingOwnerName =
    normalizeText(actingContext.ownerUser?.display_name) ||
    normalizeText(actingContext.ownerUser?.displayName);
  const entry = {
    ...payloadEntry,
    user: canActOnBehalf
      ? actingOwnerName || normalizeText(currentUser?.displayName)
      : requestedUserName || actingOwnerName || normalizeText(currentUser?.displayName),
  };
  const validationError = validateEntry(entry, currentUser);
  if (validationError) {
    return errorResponse(400, validationError);
  }

  const requestedProjectId = normalizeText(entry.projectId || entry.project_id);
  const requestedChargeCenterId = normalizeText(entry.chargeCenterId || entry.charge_center_id);
  const requestedClientName = normalizeText(entry.client);
  const requestedProjectName = normalizeText(entry.project);
  if (requestedProjectId && requestedChargeCenterId) {
    return errorResponse(400, "Select either a project or a corporate function category.");
  }
  if (!requestedProjectId && !requestedChargeCenterId && !(requestedClientName && requestedProjectName)) {
    return errorResponse(400, "Select either a project or a corporate function category.");
  }
  const project = requestedProjectId
    ? await findProjectById(sql, requestedProjectId, accountId)
    : requestedClientName && requestedProjectName
      ? await findProject(sql, requestedClientName, requestedProjectName, accountId)
      : null;
  const corporateCategory = requestedChargeCenterId
    ? await findCorporateFunctionCategoryById(sql, requestedChargeCenterId, accountId)
    : null;
  if (!project && !corporateCategory) {
    return errorResponse(404, "Project or corporate function category not found.");
  }
  const isCorporateEntry = Boolean(corporateCategory) && !project;
  const normalizedClient = isCorporateEntry
    ? "Internal"
    : normalizeText(project?.client || entry.client);
  const normalizedProject = isCorporateEntry
    ? (() => {
        const groupName = normalizeText(corporateCategory.group_name);
        const categoryName = normalizeText(corporateCategory.name);
        if (groupName && categoryName) return `${groupName} / ${categoryName}`;
        return categoryName || groupName || "Internal";
      })()
    : normalizeText(project?.name || entry.project);
  const normalizedProjectId = isCorporateEntry ? null : project?.id || null;
  const normalizedChargeCenterId = isCorporateEntry ? normalizeText(corporateCategory.id) : null;
  entry.client = normalizedClient;
  entry.project = normalizedProject;
  entry.projectId = normalizedProjectId;
  entry.chargeCenterId = normalizedChargeCenterId;

  const targetUser = canActOnBehalf
    ? actingContext.ownerUser
    : requestedUserId
      ? await findUserById(sql, requestedUserId, accountId)
      : await findUserByDisplayName(sql, entry.user, accountId);
  if (!targetUser) {
    return errorResponse(404, "Team member not found.");
  }
  entry.user =
    normalizeText(targetUser.display_name) ||
    normalizeText(targetUser.displayName) ||
    normalizeText(entry.user);
  const targetGroup = permissionGroupForUser(targetUser.level);

  if (isAdmin(currentUser)) {
    // Full access.
  } else if (isManager(currentUser)) {
    if (!isCorporateEntry) {
      const hasAccess = await managerHasProjectAccess(
        sql,
        currentUser.id,
        project.id,
        accountId
      );
      if (!hasAccess) {
        return errorResponse(403, "You are not assigned to this project.");
      }
    } else if (!canActOnBehalf && targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save your own internal entries.");
    }
    if (!canActOnBehalf && targetUser.id !== currentUser.id && targetGroup !== "staff") {
      return errorResponse(403, "Managers can only edit staff time.");
    }
  } else if (isStaff(currentUser)) {
    if (!canActOnBehalf && targetUser.id !== currentUser.id) {
      return errorResponse(403, "You can only save entries for your own account.");
    }
    if (!isCorporateEntry) {
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

  if (!isCorporateEntry && targetGroup === "staff") {
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
    if (rows[0] && rows[0].user_name !== entry.user && isStaff(currentUser) && !canActOnBehalf) {
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
      project_id,
      charge_center_id,
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

  const nextBillable = entry.chargeCenterId ? false : entry.billable === false ? false : true;
  const billableChanged = existing
    ? Boolean(existing.billable) !== nextBillable
    : false;
  const hasNonBillableContentChanges = existing
    ? !(
        existing.user_name === entry.user &&
        normalizeDateString(existing.entry_date) === normalizeDateString(entry.date) &&
        existing.client_name === entry.client &&
        existing.project_name === entry.project &&
        (existing.task || "") === (entry.task || "") &&
        Number(existing.hours) === normalizeHours(entry.hours) &&
        (existing.notes || "") === (entry.notes || "")
      )
    : true;
  const hasContentChanges = existing
    ? hasNonBillableContentChanges || billableChanged
    : true;
  const persistedNormalizedStatus = persistedStatus
    ? normalizeStatus(persistedStatus)
    : "pending";
  const actorCanApprove = !isStaff(currentUser);
  const preserveApprovedOnBillableToggle =
    Boolean(existing) &&
    persistedNormalizedStatus === "approved" &&
    billableChanged &&
    !hasNonBillableContentChanges &&
    actorCanApprove;

  const status = preserveApprovedOnBillableToggle
    ? "approved"
    : hasContentChanges
      ? "pending"
      : persistedNormalizedStatus;
  const keepApprovalMetadata =
    status === "approved" &&
    (!hasContentChanges || preserveApprovedOnBillableToggle);
  const approvedAt = keepApprovalMetadata ? existing?.approved_at : null;
  const approvedBy = keepApprovalMetadata ? existing?.approved_by_user_id : null;
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
      project_id,
      charge_center_id,
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
      ${entry.projectId || null},
      ${entry.chargeCenterId || null},
      ${normalizeText(entry.task)},
      ${normalizeHours(entry.hours)},
      ${normalizeText(entry.notes)},
      ${nextBillable},
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
      project_id = EXCLUDED.project_id,
      charge_center_id = EXCLUDED.charge_center_id,
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
    delegatedAction: canActOnBehalf,
    delegatedByUserId: canActOnBehalf ? currentUser?.id || null : null,
  });
  if (isBulkUpload) {
    afterSnapshot.bulkUpload = true;
  }

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
    await dispatchNotificationEvent(sql, {
      accountId,
      type: "time_entry_created",
      actorUserId: currentUser?.id || null,
      clientId: project?.client_id || null,
      projectId: project?.id || null,
      entryOwnerUserId: targetUser?.id || null,
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
      noteSnippet: normalizeText(entry.notes),
      deepLink: {
        view: "entries",
        subtab: "time",
        subjectId: normalizeText(entry.id),
      },
    });
  }
  if (existing) {
    const previousBillable = existing.billable === false ? false : true;
    const nextBillable = entry.billable === false ? false : true;
    if (previousBillable !== nextBillable) {
      const persistedOwnerUser = await findUserByDisplayName(
        sql,
        existing.user_name,
        accountId
      );
      await dispatchNotificationEvent(sql, {
        accountId,
        type: "entry_billing_status_updated",
        actorUserId: currentUser?.id || null,
        entryOwnerUserId: persistedOwnerUser?.id || targetUser?.id || null,
        clientId: project?.client_id || null,
        projectId: project?.id || null,
        subjectType: "time",
        subjectId: normalizeText(entry.id),
        projectName: normalizeText(entry.project),
        message: buildInboxMessage("entry_billing_status_updated", {
          actorName: currentUser?.displayName || "",
          clientName: normalizeText(entry.client),
          projectName: normalizeText(entry.project),
        }),
      });
    }
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

  await dispatchNotificationEvent(sql, {
    accountId,
    type: "entry_approved",
    actorUserId: currentUser?.id || null,
    clientId: project?.client_id || null,
    projectId: project?.id || null,
    entryOwnerUserId: targetUser?.id || null,
    subjectType: "time",
    subjectId: entry.id,
    projectName: entry.project_name || "",
    message: buildInboxMessage("entry_approved", {
      actorName: currentUser?.displayName || "",
      clientName: entry.client_name || "",
      projectName: entry.project_name || "",
      date: normalizeDateString(entry.entry_date),
    }),
    noteSnippet: normalizeText(entry.notes),
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
  const returnState = request?.returnState !== false;

  try {
    const sql = await getSql();
    await ensureSchema(sql);
    if (request.action === "validate_setup_token") {
      const result = await validateSetupToken(sql, request.payload || {});
      return json(200, result);
    }
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
    await ensureNotificationRulesForAccount(sql, accountId);
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
        if (mutationResult?.statusCode) return mutationResult;
        const clientName = normalizeText(request.payload?.clientName);
        const createdClient = await findClient(sql, clientName, accountId);
        const afterSnapshot = await snapshotClientById(sql, createdClient?.id || null, accountId);
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "client",
          entityId: createdClient?.id || randomId(),
          action: "create",
          beforeSnapshot: null,
          afterSnapshot,
          contextClientId: createdClient?.id || null,
        });
        break;
      }
      case "add_project": {
        if (!isAdmin(context.currentUser) && !isExecutive(context.currentUser)) {
          return errorResponse(403, "Executive or Admin access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        mutationResult = await addProject(
          sql,
          request.payload || {},
          context.currentUser,
          accountId
        );
        if (mutationResult?.statusCode) return mutationResult;
        const createdProject = await findProject(sql, clientName, projectName, accountId);
        const afterSnapshot = await snapshotProjectById(sql, createdProject?.id || null, accountId);
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "project",
          entityId: createdProject?.id || `${clientName}:${projectName}`,
          action: "create",
          beforeSnapshot: null,
          afterSnapshot,
          contextClientId: createdProject?.client_id || null,
          contextProjectId: createdProject?.id || null,
        });
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
        const beforeSnapshot = await snapshotClientById(sql, targetClient.id, accountId);
        mutationResult = await renameClient(sql, request.payload || {}, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        const afterSnapshot = await snapshotClientById(sql, targetClient.id, accountId);
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "client",
          entityId: targetClient.id,
          action: "update",
          beforeSnapshot,
          afterSnapshot,
          contextClientId: targetClient.id,
        });
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
        const beforeSnapshot = await snapshotClientById(sql, targetClient.id, accountId);
        mutationResult = await updateClient(sql, request.payload || {}, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        const afterSnapshot = await snapshotClientById(sql, targetClient.id, accountId);
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "client",
          entityId: targetClient.id,
          action: "update",
          beforeSnapshot,
          afterSnapshot,
          contextClientId: targetClient.id,
        });
        break;
      }
      case "rename_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        const targetProject = await findProject(sql, clientName, projectName, accountId);
        const beforeSnapshot = await snapshotProjectById(sql, targetProject?.id || null, accountId);
        mutationResult = await renameProject(sql, request.payload || {}, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        const afterSnapshot = await snapshotProjectById(sql, targetProject?.id || null, accountId);
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "project",
          entityId: targetProject?.id || `${clientName}:${projectName}`,
          action: "update",
          beforeSnapshot,
          afterSnapshot,
          contextClientId: beforeSnapshot?.client_id || afterSnapshot?.client_id || null,
          contextProjectId: targetProject?.id || null,
        });
        break;
      }
      case "update_project": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        const existingProject = await findProject(sql, clientName, projectName, accountId);
        const beforeSnapshot = await snapshotProjectById(sql, existingProject?.id || null, accountId);
        mutationResult = await updateProject(sql, request.payload || {}, context.currentUser, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        const afterSnapshot = await snapshotProjectById(sql, existingProject?.id || null, accountId);
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "project",
          entityId: existingProject?.id || normalizeText(request.payload?.projectId) || `${clientName}:${projectName}`,
          action: "update",
          beforeSnapshot,
          afterSnapshot,
          contextClientId: beforeSnapshot?.client_id || afterSnapshot?.client_id || null,
          contextProjectId: existingProject?.id || null,
        });
        break;
      }
      case "create_department": {
        if (!can("manage_departments")) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await createDepartment(sql, request.payload || {}, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        const afterSnapshot = mutationResult
          ? {
              id: normalizeText(mutationResult.id),
              name: normalizeText(mutationResult.name),
            }
          : null;
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "department",
          entityId: afterSnapshot?.id || randomId(),
          action: "create",
          beforeSnapshot: null,
          afterSnapshot,
        });
        break;
      }
      case "rename_department": {
        if (!can("manage_departments")) {
          return errorResponse(403, "Access denied.");
        }
        const departmentId = normalizeText(request.payload?.id);
        const beforeRows = await sql`
          SELECT id, name
          FROM departments
          WHERE id = ${departmentId}
            AND account_id = ${accountId}::uuid
          LIMIT 1
        `;
        const beforeSnapshot = beforeRows[0]
          ? { id: normalizeText(beforeRows[0].id), name: normalizeText(beforeRows[0].name) }
          : null;
        mutationResult = await renameDepartment(sql, request.payload || {}, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        const afterSnapshot = mutationResult
          ? { id: normalizeText(mutationResult.id), name: normalizeText(mutationResult.name) }
          : null;
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "department",
          entityId: afterSnapshot?.id || departmentId || randomId(),
          action: "update",
          beforeSnapshot,
          afterSnapshot,
        });
        break;
      }
      case "delete_department": {
        if (!can("manage_departments")) {
          return errorResponse(403, "Access denied.");
        }
        const departmentId = normalizeText(request.payload?.id);
        const beforeRows = await sql`
          SELECT id, name
          FROM departments
          WHERE id = ${departmentId}
            AND account_id = ${accountId}::uuid
          LIMIT 1
        `;
        const beforeSnapshot = beforeRows[0]
          ? { id: normalizeText(beforeRows[0].id), name: normalizeText(beforeRows[0].name) }
          : null;
        mutationResult = await deleteDepartment(sql, request.payload || {}, accountId);
        if (mutationResult?.statusCode) return mutationResult;
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "department",
          entityId: departmentId || randomId(),
          action: "delete",
          beforeSnapshot,
          afterSnapshot: null,
        });
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
        const beforeSnapshot = {
          permissions: await snapshotRolePermissions(sql, accountId),
        };
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
        const afterSnapshot = {
          permissions: await snapshotRolePermissions(sql, accountId),
        };
        await logEntityAudit(sql, {
          accountId,
          context,
          entityType: "role_permission",
          entityId: "own_office",
          action: "update",
          beforeSnapshot,
          afterSnapshot,
        });
        break;
      }
      case "create_delegation": {
        if (!can("can_delegate")) {
          return errorResponse(403, "Access denied.");
        }
        const delegateUserId = normalizeText(request.payload?.delegateUserId);
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "delegation",
          entityId: `${context.currentUser?.id || ""}:${delegateUserId || ""}`,
          action: "update",
          runMutation: () =>
            createDelegation(
              sql,
              { ...(request.payload || {}), delegatorUserId: context.currentUser?.id || "" },
              accountId
            ),
          getSnapshot: () => snapshotDelegation(sql, accountId, context.currentUser?.id || null, delegateUserId),
          targetUserId: delegateUserId || null,
        });
        break;
      }
      case "delete_delegation": {
        if (!can("can_delegate")) {
          return errorResponse(403, "Access denied.");
        }
        const delegateUserId = normalizeText(request.payload?.delegateUserId);
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "delegation",
          entityId: `${context.currentUser?.id || ""}:${delegateUserId || ""}`,
          action: "delete",
          runMutation: () =>
            deleteDelegation(
              sql,
              { ...(request.payload || {}), delegatorUserId: context.currentUser?.id || "" },
              accountId
            ),
          getBeforeSnapshot: () =>
            snapshotDelegation(sql, accountId, context.currentUser?.id || null, delegateUserId),
          getAfterSnapshot: () => ({
            delegator_user_id: context.currentUser?.id || null,
            delegate_user_id: delegateUserId || null,
            capabilities: [],
          }),
          targetUserId: delegateUserId || null,
        });
        break;
      }
      case "save_delegate_capabilities": {
        if (!can("can_delegate")) {
          return errorResponse(403, "Access denied.");
        }
        const delegateUserId = normalizeText(request.payload?.delegateUserId);
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "delegation",
          entityId: `${context.currentUser?.id || ""}:${delegateUserId || ""}`,
          action: "update",
          runMutation: () =>
            saveDelegateCapabilities(
              sql,
              { ...(request.payload || {}), delegatorUserId: context.currentUser?.id || "" },
              accountId
            ),
          getSnapshot: () => snapshotDelegation(sql, accountId, context.currentUser?.id || null, delegateUserId),
          targetUserId: delegateUserId || null,
        });
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
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "client",
          entityId: targetClient.id,
          action: "delete",
          runMutation: () => removeClient(sql, request.payload || {}, accountId),
          getBeforeSnapshot: () => snapshotClientById(sql, targetClient.id, accountId),
          contextClientId: targetClient.id,
        });
        break;
      }
      case "deactivate_client": {
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
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "client",
          entityId: targetClient.id,
          action: "update",
          runMutation: () => deactivateClient(sql, request.payload || {}, accountId),
          getSnapshot: () => snapshotClientById(sql, targetClient.id, accountId),
          contextClientId: targetClient.id,
        });
        break;
      }
      case "reactivate_client": {
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
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "client",
          entityId: targetClient.id,
          action: "update",
          runMutation: () => reactivateClient(sql, request.payload || {}, accountId),
          getSnapshot: () => snapshotClientById(sql, targetClient.id, accountId),
          contextClientId: targetClient.id,
        });
        break;
      }
      case "remove_project": {
        let targetProject = null;
        if (isAdmin(context.currentUser)) {
          targetProject = await findProject(
            sql,
            normalizeText(request.payload?.clientName),
            normalizeText(request.payload?.projectName),
            accountId
          );
          if (!targetProject) {
            return errorResponse(404, "Project not found.");
          }
          mutationResult = await runMutationWithAudit({
            sql,
            accountId,
            context,
            entityType: "project",
            entityId: targetProject.id,
            action: "delete",
            runMutation: () => removeProject(sql, request.payload || {}, accountId),
            getBeforeSnapshot: () => snapshotProjectById(sql, targetProject.id, accountId),
            contextClientId: targetProject.client_id || null,
            contextProjectId: targetProject.id,
          });
          break;
        }
        if (!isManager(context.currentUser)) {
          return errorResponse(403, "Manager access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        targetProject = await findProject(sql, clientName, projectName, accountId);
        if (!targetProject) {
          return errorResponse(404, "Project not found.");
        }
        const projectRow = await sql`
          SELECT created_by
          FROM projects
          WHERE id = ${targetProject.id}
            AND account_id = ${accountId}::uuid
          LIMIT 1
        `;
        const createdBy = projectRow[0]?.created_by || "";
        if (createdBy !== context.currentUser.id) {
          return errorResponse(403, "You can only remove projects you created.");
      }
      mutationResult = await runMutationWithAudit({
        sql,
        accountId,
        context,
        entityType: "project",
        entityId: targetProject.id,
        action: "delete",
        runMutation: () => removeProject(sql, request.payload || {}, accountId),
        getBeforeSnapshot: () => snapshotProjectById(sql, targetProject.id, accountId),
        contextClientId: targetProject.client_id || null,
        contextProjectId: targetProject.id,
      });
      break;
    }
      case "deactivate_project": {
        let targetProject = null;
        if (isAdmin(context.currentUser)) {
          targetProject = await findProject(
            sql,
            normalizeText(request.payload?.clientName),
            normalizeText(request.payload?.projectName),
            accountId
          );
          if (!targetProject) {
            return errorResponse(404, "Project not found.");
          }
          mutationResult = await runMutationWithAudit({
            sql,
            accountId,
            context,
            entityType: "project",
            entityId: targetProject.id,
            action: "update",
            runMutation: () => deactivateProject(sql, request.payload || {}, accountId),
            getSnapshot: () => snapshotProjectById(sql, targetProject.id, accountId),
            contextClientId: targetProject.client_id || null,
            contextProjectId: targetProject.id,
          });
          break;
        }
        const managerUser = isManager(context.currentUser);
        const executiveUser = isExecutive(context.currentUser);
        if (!managerUser && !executiveUser) {
          return errorResponse(403, "Manager or Executive access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        targetProject = await findProject(sql, clientName, projectName, accountId);
        if (!targetProject) {
          return errorResponse(404, "Project not found.");
        }
        const projectRow = await sql`
          SELECT created_by
          FROM projects
          WHERE id = ${targetProject.id}
            AND account_id = ${accountId}::uuid
          LIMIT 1
        `;
        const createdBy = projectRow[0]?.created_by || "";
        if (managerUser && !executiveUser && createdBy !== context.currentUser.id) {
          return errorResponse(403, "You can only deactivate projects you created.");
        }
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "project",
          entityId: targetProject.id,
          action: "update",
          runMutation: () => deactivateProject(sql, request.payload || {}, accountId),
          getSnapshot: () => snapshotProjectById(sql, targetProject.id, accountId),
          contextClientId: targetProject.client_id || null,
          contextProjectId: targetProject.id,
        });
        break;
      }
      case "reactivate_project": {
        let targetProject = null;
        if (isAdmin(context.currentUser)) {
          targetProject = await findProject(
            sql,
            normalizeText(request.payload?.clientName),
            normalizeText(request.payload?.projectName),
            accountId
          );
          if (!targetProject) {
            return errorResponse(404, "Project not found.");
          }
          mutationResult = await runMutationWithAudit({
            sql,
            accountId,
            context,
            entityType: "project",
            entityId: targetProject.id,
            action: "update",
            runMutation: () => reactivateProject(sql, request.payload || {}, accountId),
            getSnapshot: () => snapshotProjectById(sql, targetProject.id, accountId),
            contextClientId: targetProject.client_id || null,
            contextProjectId: targetProject.id,
          });
          break;
        }
        const managerUser = isManager(context.currentUser);
        const executiveUser = isExecutive(context.currentUser);
        if (!managerUser && !executiveUser) {
          return errorResponse(403, "Manager or Executive access required.");
        }
        const clientName = normalizeText(request.payload?.clientName);
        const projectName = normalizeText(request.payload?.projectName);
        targetProject = await findProject(sql, clientName, projectName, accountId);
        if (!targetProject) {
          return errorResponse(404, "Project not found.");
        }
        const projectRow = await sql`
          SELECT created_by
          FROM projects
          WHERE id = ${targetProject.id}
            AND account_id = ${accountId}::uuid
          LIMIT 1
        `;
        const createdBy = projectRow[0]?.created_by || "";
        if (managerUser && !executiveUser && createdBy !== context.currentUser.id) {
          return errorResponse(403, "You can only reactivate projects you created.");
        }
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "project",
          entityId: targetProject.id,
          action: "update",
          runMutation: () => reactivateProject(sql, request.payload || {}, accountId),
          getSnapshot: () => snapshotProjectById(sql, targetProject.id, accountId),
          contextClientId: targetProject.client_id || null,
          contextProjectId: targetProject.id,
        });
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
      case "save_project_advanced_budget": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const projectId = normalizeText(request.payload?.projectId);
        const members = Array.isArray(request.payload?.members) ? request.payload.members : [];
        if (!projectId) {
          return errorResponse(400, "Project id is required.");
        }
        const existing = await getProjectMemberBudgets(sql, projectId, accountId);
        for (const row of existing) {
          await deleteProjectMemberBudget(sql, projectId, row?.userId, accountId);
        }
        for (const member of members) {
          const userId = normalizeText(member?.userId);
          if (!userId) continue;
          await upsertProjectMemberBudget(
            sql,
            {
              projectId,
              userId,
              budgetHours: member?.budgetHours ?? null,
              budgetAmount: member?.budgetAmount ?? null,
              rateOverride: member?.rateOverride ?? null,
            },
            accountId
          );
        }
        mutationResult = { ok: true };
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
      case "mark_inbox_items_read": {
        mutationResult = await markInboxItemsRead(
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
      case "update_notification_rule": {
        if (!can("manage_settings_access")) {
          return errorResponse(403, "Access denied.");
        }
        const eventType = normalizeText(request.payload?.eventType);
        const getRuleSnapshot = async () => {
          if (!eventType) return null;
          const rows = await sql`
            SELECT event_type, inbox_enabled, email_enabled, enabled
            FROM notification_rules
            WHERE account_id = ${accountId}::uuid
              AND event_type = ${eventType}
            LIMIT 1
          `;
          const rule = rows[0];
          return rule
            ? {
                event_type: normalizeText(rule.event_type),
                inbox_enabled: rule.inbox_enabled === true,
                email_enabled: rule.email_enabled === true,
                enabled: rule.enabled === true,
              }
            : null;
        };
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "notification_rule",
          entityId: eventType || "unknown",
          action: "update",
          runMutation: () => updateNotificationRule(sql, request.payload || {}, accountId),
          getSnapshot: getRuleSnapshot,
        });
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
        try {
          await sendSetupEmail({
            to: targetEmail,
            username: createdUser.username,
            token: setup.token,
          });
        } catch (error) {
          mutationResult = {
            message: `Member added, but setup email failed: ${error?.message || "Unknown error."}`,
          };
        }
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
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "level_label",
          entityId: "all",
          action: "update",
          runMutation: () => updateLevelLabels(sql, request.payload || {}, accountId),
          getSnapshot: async () => ({ levels: await snapshotLevelLabels(sql, accountId) }),
        });
        break;
      }
      case "update_expense_categories": {
        if (!can("manage_expense_categories", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "expense_category",
          entityId: "all",
          action: "update",
          runMutation: () => updateExpenseCategories(sql, request.payload || {}, accountId),
          getSnapshot: async () => ({ categories: await snapshotExpenseCategories(sql, accountId) }),
        });
        break;
      }
      case "update_corporate_function_categories": {
        if (!can("manage_expense_categories", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "corporate_function_category",
          entityId: "all",
          action: "update",
          runMutation: () =>
            updateCorporateFunctionCategories(sql, request.payload || {}, accountId),
          getSnapshot: () => snapshotCorporateFunctions(sql, accountId),
        });
        break;
      }
      case "update_office_locations": {
        if (!can("manage_office_locations", { resourceOfficeId: context.currentUser?.officeId || null })) {
          return errorResponse(403, "Access denied.");
        }
        mutationResult = await runMutationWithAudit({
          sql,
          accountId,
          context,
          entityType: "office_location",
          entityId: "all",
          action: "update",
          runMutation: () => updateOfficeLocations(sql, request.payload || {}, accountId),
          getSnapshot: async () => ({ offices: await snapshotOfficeLocations(sql, accountId) }),
        });
        break;
      }
      case "list_audit_logs": {
        const adminError = requireAdmin(context);
        if (adminError) return adminError;
        const result = await listAuditLogs(sql, accountId, request.payload?.filters || {});
        return json(200, {
          auditLogs: Array.isArray(result?.rows) ? result.rows : [],
          hasMore: Boolean(result?.hasMore),
          nextOffset: Number(result?.nextOffset || 0),
          auditDateBounds: {
            minChangedAt: result?.bounds?.minChangedAt || null,
            maxChangedAt: result?.bounds?.maxChangedAt || null,
          },
        });
      }
      default:
        return errorResponse(400, "Unknown mutation action.");
    }

    if (mutationResult && mutationResult.statusCode) {
      return mutationResult;
    }
    if (!returnState) {
      return json(200, { ok: true });
    }

    const state = await loadState(sql, context.currentUser);
    const { permissions: permissionsPayload, canManageSettingsAccess } =
      buildPermissionsPayload(state.currentUser, permissionIndex);
    const permissionRoles = canManageSettingsAccess
      ? await sql`
          SELECT key, label, is_active AS "isActive"
          FROM permission_roles
          WHERE is_active = TRUE
          ORDER BY id
        `
      : [];
    return json(200, {
      ...state,
      permissions: permissionsPayload,
      permissionRoles,
      rolePermissions: canManageSettingsAccess ? permissionRows : [],
      message: mutationResult?.message || "",
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to apply database mutation.");
  }
};
