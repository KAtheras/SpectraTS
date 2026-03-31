"use strict";

const crypto = require("crypto");

const SUPPORTED_EVENT_TYPES = new Set([
  "time_entry_created",
  "expense_entry_created",
  "entry_approved",
  "delegation_updated",
  "project_assignment_updated",
  "entry_billing_status_updated",
]);

function randomId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

function buildInboxMessage(type, data = {}) {
  const actorName = `${data.actorName || "Someone"}`.trim() || "Someone";
  const clientName = `${data.clientName || ""}`.trim();
  const projectName = `${data.projectName || ""}`.trim();
  const projectLabel = clientName && projectName
    ? `${clientName} / ${projectName}`
    : projectName || clientName || "Unknown project";
  const dateLabel = `${data.date || ""}`.trim();

  if (type === "time_entry_created") {
    const hours = Number(data.hours);
    const hoursLabel = Number.isFinite(hours) && hours > 0 ? ` (${hours}h)` : "";
    const datePart = dateLabel ? ` on ${dateLabel}` : "";
    return `${actorName} created a time entry for ${projectLabel}${datePart}${hoursLabel}.`;
  }
  if (type === "expense_entry_created") {
    const amountLabel = formatAmount(data.amount);
    const datePart = dateLabel ? ` on ${dateLabel}` : "";
    return `${actorName} created an expense for ${projectLabel}${datePart} (${amountLabel}).`;
  }
  if (type === "entry_approved") {
    const datePart = dateLabel ? ` on ${dateLabel}` : "";
    return `${actorName} approved your time entry for ${projectLabel}${datePart}.`;
  }
  if (type === "delegation_updated") {
    return `${actorName} updated your delegation access.`;
  }
  if (type === "project_assignment_updated") {
    return `${actorName} updated your project assignment for ${projectLabel}.`;
  }
  if (type === "entry_billing_status_updated") {
    return `${actorName} updated billing status for your entry in ${projectLabel}.`;
  }
  return `${actorName} updated ${projectLabel}.`;
}

function normalizeNoteSnippet(note, maxLength = 80) {
  const normalized = String(note || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

async function listManagerRecipientUserIds(sql, { accountId, clientId, projectId }) {
  const ids = new Set();
  if (projectId) {
    const projectRows = await sql`
      SELECT manager_id AS "managerId"
      FROM manager_projects
      WHERE account_id = ${accountId}::uuid
        AND project_id = ${projectId}
    `;
    projectRows.forEach((row) => {
      if (row?.managerId) ids.add(row.managerId);
    });
  }
  if (clientId) {
    const clientRows = await sql`
      SELECT manager_id AS "managerId"
      FROM manager_clients
      WHERE account_id = ${accountId}::uuid
        AND client_id = ${clientId}
    `;
    clientRows.forEach((row) => {
      if (row?.managerId) ids.add(row.managerId);
    });
  }
  return Array.from(ids);
}

async function createSystemInboxItems(sql, payload = {}) {
  const accountId = payload.accountId;
  const recipientUserIds = Array.isArray(payload.recipientUserIds) ? payload.recipientUserIds : [];
  const uniqueRecipients = Array.from(
    new Set(recipientUserIds.map((id) => `${id || ""}`.trim()).filter(Boolean))
  );
  if (!accountId || !uniqueRecipients.length) return;

  const type = `${payload.type || ""}`.trim();
  const actorUserId = `${payload.actorUserId || ""}`.trim() || null;
  const subjectType = `${payload.subjectType || ""}`.trim();
  const subjectId = `${payload.subjectId || ""}`.trim();
  if (!type || !subjectType || !subjectId) return;

  const message = payload.message
    ? `${payload.message}`.trim()
    : buildInboxMessage(type, payload.messageData || {});
  const noteSnippet = normalizeNoteSnippet(payload.noteSnippet || payload.note || "");
  const projectNameSnapshot = payload.projectName ? `${payload.projectName}`.trim() : null;
  const deepLink = payload.deepLink && typeof payload.deepLink === "object" ? payload.deepLink : null;

  for (const recipientUserId of uniqueRecipients) {
    await sql`
      INSERT INTO inbox_items (
        id,
        account_id,
        type,
        recipient_user_id,
        actor_user_id,
        subject_type,
        subject_id,
        message,
        note_snippet,
        is_read,
        project_name_snapshot,
        deep_link_json
      )
      VALUES (
        ${randomId()},
        ${accountId}::uuid,
        ${type},
        ${recipientUserId},
        ${actorUserId},
        ${subjectType},
        ${subjectId},
        ${message},
        ${noteSnippet},
        FALSE,
        ${projectNameSnapshot},
        ${deepLink ? JSON.stringify(deepLink) : null}::jsonb
      )
    `;
  }
}

async function getNotificationRule(sql, { accountId, eventType }) {
  if (!accountId || !eventType || !SUPPORTED_EVENT_TYPES.has(eventType)) return null;
  const rows = await sql`
    SELECT
      event_type AS "eventType",
      enabled,
      inbox_enabled AS "inboxEnabled",
      email_enabled AS "emailEnabled",
      recipient_scope AS "recipientScope",
      delivery_mode AS "deliveryMode"
    FROM notification_rules
    WHERE account_id = ${accountId}::uuid
      AND event_type = ${eventType}
    LIMIT 1
  `;
  return rows[0] || null;
}

function shouldDeliverImmediateInbox(rule) {
  if (!rule) return false;
  if (rule.enabled === false || rule.enabled === 0) return false;
  if (rule.inboxEnabled === false || rule.inboxEnabled === 0) return false;
  return String(rule.deliveryMode || "").trim().toLowerCase() === "immediate";
}

async function resolveRecipientsByScope(sql, payload = {}, rule = null) {
  const scope = String(rule?.recipientScope || "").trim().toLowerCase();
  const accountId = payload.accountId;
  if (scope === "project_manager") {
    const ids = await listManagerRecipientUserIds(sql, {
      accountId,
      clientId: payload.clientId || null,
      projectId: payload.projectId || null,
    });
    const actorUserId = `${payload.actorUserId || ""}`.trim();
    return ids.filter((id) => `${id || ""}`.trim() && `${id}` !== actorUserId);
  }
  if (scope === "entry_owner") {
    const ownerId = `${payload.entryOwnerUserId || ""}`.trim();
    return ownerId ? [ownerId] : [];
  }
  if (scope === "delegated_member") {
    const delegateId = `${payload.delegateUserId || ""}`.trim();
    return delegateId ? [delegateId] : [];
  }
  if (scope === "assigned_member") {
    const assignedUserId = `${payload.assignedUserId || ""}`.trim();
    return assignedUserId ? [assignedUserId] : [];
  }
  return [];
}

async function dispatchNotificationEvent(sql, payload = {}) {
  const eventType = `${payload.type || ""}`.trim();
  if (!SUPPORTED_EVENT_TYPES.has(eventType)) return;
  const accountId = payload.accountId;
  if (!accountId) return;

  const rule = await getNotificationRule(sql, { accountId, eventType });
  if (!shouldDeliverImmediateInbox(rule)) return;

  const recipientUserIds = await resolveRecipientsByScope(sql, payload, rule);
  if (!recipientUserIds.length) return;

  await createSystemInboxItems(sql, {
    ...payload,
    recipientUserIds,
  });
}

module.exports = {
  buildInboxMessage,
  listManagerRecipientUserIds,
  createSystemInboxItems,
  dispatchNotificationEvent,
  normalizeNoteSnippet,
};
