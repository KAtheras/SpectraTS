"use strict";

const crypto = require("crypto");

const SUPPORTED_EVENT_TYPES = new Set([
  "time_entry_created",
  "expense_entry_created",
  "entry_approved",
  "expense_approved",
  "delegation_updated",
  "project_assignment_updated",
  "entry_billing_status_updated",
  "expense_billing_status_updated",
]);
const EMAIL_ENABLED_EVENT_TYPES = new Set([
  "project_assignment_updated",
  "delegation_updated",
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
  if (type === "expense_approved") {
    const datePart = dateLabel ? ` on ${dateLabel}` : "";
    return `${actorName} approved your expense for ${projectLabel}${datePart}.`;
  }
  if (type === "delegation_updated") {
    return `${actorName} updated your delegation access.`;
  }
  if (type === "project_assignment_updated") {
    const change = `${data.assignmentChange || ""}`.trim().toLowerCase();
    const targetProject = projectName || projectLabel;
    if (change === "removed") {
      return `${actorName} removed you from project ${targetProject}.`;
    }
    if (change === "added") {
      return `${actorName} added you to project ${targetProject}.`;
    }
    return `${actorName} updated your project assignment for ${projectLabel}.`;
  }
  if (type === "entry_billing_status_updated") {
    return `${actorName} updated billing status for your entry in ${projectLabel}.`;
  }
  if (type === "expense_billing_status_updated") {
    return `${actorName} updated billing status for your expense in ${projectLabel}.`;
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
  if (projectId) {
    const projectRows = await sql`
      SELECT mp.manager_id AS "managerId"
      FROM manager_projects mp
      JOIN users u
        ON u.id = mp.manager_id
       AND u.account_id = mp.account_id
       AND u.is_active = TRUE
      WHERE mp.account_id = ${accountId}::uuid
        AND mp.project_id = ${projectId}
      ORDER BY mp.created_at ASC, mp.id ASC
      LIMIT 1
    `;
    const nearestProjectManagerId = `${projectRows[0]?.managerId || ""}`.trim();
    if (nearestProjectManagerId) {
      return [nearestProjectManagerId];
    }
  }
  if (clientId) {
    const clientRows = await sql`
      SELECT mc.manager_id AS "managerId"
      FROM manager_clients mc
      JOIN users u
        ON u.id = mc.manager_id
       AND u.account_id = mc.account_id
       AND u.is_active = TRUE
      WHERE mc.account_id = ${accountId}::uuid
        AND mc.client_id = ${clientId}
      ORDER BY mc.created_at ASC, mc.id ASC
      LIMIT 1
    `;
    const nearestClientManagerId = `${clientRows[0]?.managerId || ""}`.trim();
    if (nearestClientManagerId) {
      return [nearestClientManagerId];
    }
  }
  return [];
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

function shouldDeliverImmediateEmail(rule, eventType) {
  if (!rule) return false;
  if (!EMAIL_ENABLED_EVENT_TYPES.has(eventType)) return false;
  if (rule.enabled === false || rule.enabled === 0) return false;
  if (rule.emailEnabled === false || rule.emailEnabled === 0) return false;
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
  if (scope === "expense_owner") {
    const ownerId = `${payload.expenseOwnerUserId || ""}`.trim();
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

async function listRecipientsForDelivery(sql, { accountId, recipientUserIds }) {
  const ids = Array.isArray(recipientUserIds)
    ? Array.from(new Set(recipientUserIds.map((id) => `${id || ""}`.trim()).filter(Boolean)))
    : [];
  if (!ids.length) return [];
  return sql`
    SELECT
      id,
      display_name AS "displayName",
      email
    FROM users
    WHERE account_id = ${accountId}::uuid
      AND id = ANY(${ids})
      AND is_active = TRUE
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildNotificationEmailContent(eventType, payload = {}) {
  const actorName = `${payload.actorName || "Someone"}`.trim() || "Someone";
  const projectName = `${payload.projectName || ""}`.trim();
  if (eventType === "project_assignment_updated") {
    const change = `${payload.assignmentChange || ""}`.trim().toLowerCase();
    const changeLabel = change === "removed" ? "Removed from project" : "Added to project";
    return {
      subject: "Project assignment updated",
      html: `
        <p>Your project assignment was updated.</p>
        ${projectName ? `<p><strong>Project:</strong> ${escapeHtml(projectName)}</p>` : ""}
        <p><strong>Change:</strong> ${escapeHtml(changeLabel)}</p>
        <p><strong>Updated by:</strong> ${escapeHtml(actorName)}</p>
      `,
    };
  }
  if (eventType === "delegation_updated") {
    return {
      subject: "Delegation updated",
      html: `
        <p>Your delegation access was updated.</p>
        <p><strong>Updated by:</strong> ${escapeHtml(actorName)}</p>
      `,
    };
  }
  return null;
}

async function sendNotificationEmail({ to, subject, html }) {
  const { sendEmail } = require("./send-email");
  if (typeof sendEmail !== "function") {
    throw new Error("send-email helper is unavailable");
  }
  await sendEmail({ to, subject, html });
}

async function deliverNotificationEmails(sql, payload = {}, recipientUserIds = []) {
  const eventType = `${payload.type || ""}`.trim();
  const accountId = payload.accountId;
  const content = buildNotificationEmailContent(eventType, payload);
  if (!content || !accountId) return;
  const recipients = await listRecipientsForDelivery(sql, { accountId, recipientUserIds });
  for (const recipient of recipients) {
    const email = `${recipient?.email || ""}`.trim();
    if (!email || !email.includes("@")) continue;
    try {
      await sendNotificationEmail({
        to: email,
        subject: content.subject,
        html: content.html,
      });
    } catch (error) {
      console.error("[notifications] email delivery failed", {
        eventType,
        recipientUserId: recipient?.id || null,
        message: error?.message || String(error),
      });
    }
  }
}

async function dispatchNotificationEvent(sql, payload = {}) {
  const eventType = `${payload.type || ""}`.trim();
  if (!SUPPORTED_EVENT_TYPES.has(eventType)) return;
  const accountId = payload.accountId;
  if (!accountId) return;

  const rule = await getNotificationRule(sql, { accountId, eventType });
  const deliverInbox = shouldDeliverImmediateInbox(rule);
  const deliverEmail = shouldDeliverImmediateEmail(rule, eventType);
  if (!deliverInbox && !deliverEmail) return;

  const recipientUserIds = await resolveRecipientsByScope(sql, payload, rule);
  if (!recipientUserIds.length) return;

  const suppressInboxRecipientSet = new Set(
    (Array.isArray(payload.suppressInboxRecipientUserIds)
      ? payload.suppressInboxRecipientUserIds
      : []
    )
      .map((id) => `${id || ""}`.trim())
      .filter(Boolean)
  );
  const inboxRecipientUserIds = suppressInboxRecipientSet.size
    ? recipientUserIds.filter((id) => !suppressInboxRecipientSet.has(`${id || ""}`.trim()))
    : recipientUserIds;

  if (deliverInbox) {
    if (inboxRecipientUserIds.length) {
      await createSystemInboxItems(sql, {
        ...payload,
        recipientUserIds: inboxRecipientUserIds,
      });
    }
  }
  if (deliverEmail) {
    await deliverNotificationEmails(sql, payload, recipientUserIds);
  }
}

module.exports = {
  buildInboxMessage,
  listManagerRecipientUserIds,
  createSystemInboxItems,
  dispatchNotificationEvent,
  normalizeNoteSnippet,
};
