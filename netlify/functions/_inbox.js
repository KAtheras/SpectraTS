"use strict";

const crypto = require("crypto");

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

module.exports = {
  buildInboxMessage,
  listManagerRecipientUserIds,
  createSystemInboxItems,
  normalizeNoteSnippet,
};
