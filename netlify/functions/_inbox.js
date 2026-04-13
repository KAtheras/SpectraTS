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
const TIME_DAILY_DIGEST_TYPE = "time_entry_daily_digest";
const TIME_DAILY_DIGEST_SUBJECT_TYPE = "time_digest";

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

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function formatHoursCompact(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0";
  const rounded = Math.round(numeric * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function normalizeDigestDate(value) {
  if (!value && value !== 0) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = `${value || ""}`.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/i.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function buildTimeDigestMessage({
  entryCount,
  totalHours,
  memberCount,
  projectCount,
}) {
  return `Today your team entered ${entryCount} time entr${
    entryCount === 1 ? "y" : "ies"
  } totaling ${formatHoursCompact(totalHours)} hours across ${memberCount} member${
    memberCount === 1 ? "" : "s"
  } and ${projectCount} project${projectCount === 1 ? "" : "s"}.`;
}

function buildTimeDigestNote({ members, projects }) {
  const topProjects = (Array.isArray(projects) ? projects : [])
    .slice(0, 3)
    .map((row) => `${row.projectLabel} ${formatHoursCompact(row.totalHours)}h`)
    .join(", ");
  const topMembers = (Array.isArray(members) ? members : [])
    .slice(0, 3)
    .map((row) => `${row.memberName} ${formatHoursCompact(row.totalHours)}h`)
    .join(", ");
  const parts = [];
  if (topProjects) parts.push(`Projects: ${topProjects}`);
  if (topMembers) parts.push(`Members: ${topMembers}`);
  return parts.join(" • ");
}

function buildTimeDigestDeepLink({
  digestDate,
  entryIds,
  members,
  projects,
  entryCount,
  totalHours,
}) {
  const baseFilters = {
    from: digestDate,
    to: digestDate,
  };
  const sortedMembers = (Array.isArray(members) ? members : []).slice().sort((a, b) => {
    if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
    return String(a.memberName || "").localeCompare(String(b.memberName || ""));
  });
  const sortedProjects = (Array.isArray(projects) ? projects : []).slice().sort((a, b) => {
    if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
    return String(a.projectLabel || "").localeCompare(String(b.projectLabel || ""));
  });
  const actions = [
    {
      label: "View all",
      filters: { ...baseFilters },
    },
  ];
  sortedProjects.slice(0, 5).forEach((project) => {
    actions.push({
      label: `${project.projectLabel} (${formatHoursCompact(project.totalHours)}h)`,
      filters: {
        ...baseFilters,
        client: project.clientName,
        project: project.projectName,
      },
    });
  });
  sortedMembers.slice(0, 5).forEach((member) => {
    actions.push({
      label: `${member.memberName} (${formatHoursCompact(member.totalHours)}h)`,
      filters: {
        ...baseFilters,
        user: member.memberName,
      },
    });
  });
  return {
    view: "entries",
    subtab: "time",
    subjectType: TIME_DAILY_DIGEST_SUBJECT_TYPE,
    subjectId: digestDate,
    filters: baseFilters,
    actions,
    digest: {
      digestDate,
      entryCount,
      totalHours: Math.round(Number(totalHours || 0) * 10) / 10,
      distinctMembers: sortedMembers.length,
      distinctProjects: sortedProjects.length,
      members: sortedMembers,
      projects: sortedProjects,
      entryIds: Array.isArray(entryIds) ? entryIds : [],
    },
  };
}

function mergeTimeDigestEntry(previousDigest, entryRow) {
  const digest = previousDigest && typeof previousDigest === "object" ? previousDigest : {};
  const existingEntryIds = new Set(
    (Array.isArray(digest.entryIds) ? digest.entryIds : [])
      .map((id) => `${id || ""}`.trim())
      .filter(Boolean)
  );
  const entryId = `${entryRow?.id || ""}`.trim();
  if (!entryId || existingEntryIds.has(entryId)) {
    return digest;
  }
  existingEntryIds.add(entryId);

  const existingMembers = Array.isArray(digest.members) ? digest.members : [];
  const memberMap = new Map();
  existingMembers.forEach((row) => {
    const key = `${row?.memberId || row?.memberName || ""}`.trim();
    if (!key) return;
    memberMap.set(key, {
      memberId: `${row?.memberId || ""}`.trim() || null,
      memberName: `${row?.memberName || ""}`.trim() || "Unknown member",
      entryCount: Number(row?.entryCount || 0),
      totalHours: Number(row?.totalHours || 0),
    });
  });
  const memberKey = `${entryRow?.userId || entryRow?.memberName || ""}`.trim() || entryId;
  const memberCurrent = memberMap.get(memberKey) || {
    memberId: `${entryRow?.userId || ""}`.trim() || null,
    memberName: `${entryRow?.memberName || ""}`.trim() || "Unknown member",
    entryCount: 0,
    totalHours: 0,
  };
  memberCurrent.entryCount += 1;
  memberCurrent.totalHours += Number(entryRow?.hours || 0);
  memberMap.set(memberKey, memberCurrent);

  const existingProjects = Array.isArray(digest.projects) ? digest.projects : [];
  const projectMap = new Map();
  existingProjects.forEach((row) => {
    const key = `${row?.projectId || ""}|${row?.clientName || ""}|${row?.projectName || ""}`.trim();
    if (!key) return;
    projectMap.set(key, {
      projectId: row?.projectId || null,
      clientName: `${row?.clientName || ""}`.trim(),
      projectName: `${row?.projectName || ""}`.trim(),
      projectLabel: (() => {
        const explicit = `${row?.projectLabel || ""}`.trim();
        if (explicit) return explicit;
        const clientName = `${row?.clientName || ""}`.trim();
        const projectName = `${row?.projectName || ""}`.trim();
        if (clientName && projectName) return `${clientName} / ${projectName}`;
        return projectName || clientName || "Unknown project";
      })(),
      entryCount: Number(row?.entryCount || 0),
      totalHours: Number(row?.totalHours || 0),
    });
  });
  const projectKey = `${entryRow?.projectId || ""}|${entryRow?.clientName || ""}|${entryRow?.projectName || ""}`.trim();
  const projectCurrent = projectMap.get(projectKey) || {
    projectId: entryRow?.projectId || null,
    clientName: `${entryRow?.clientName || ""}`.trim(),
    projectName: `${entryRow?.projectName || ""}`.trim(),
    projectLabel: `${entryRow?.clientName || ""}`.trim() && `${entryRow?.projectName || ""}`.trim()
      ? `${`${entryRow?.clientName || ""}`.trim()} / ${`${entryRow?.projectName || ""}`.trim()}`
      : `${entryRow?.projectName || entryRow?.clientName || "Unknown project"}`,
    entryCount: 0,
    totalHours: 0,
  };
  projectCurrent.entryCount += 1;
  projectCurrent.totalHours += Number(entryRow?.hours || 0);
  projectMap.set(projectKey, projectCurrent);

  const members = Array.from(memberMap.values());
  const projects = Array.from(projectMap.values());
  const entryCount = existingEntryIds.size;
  const totalHours = Array.from(projectMap.values()).reduce(
    (sum, row) => sum + Number(row?.totalHours || 0),
    0
  );
  return {
    digestDate: digest.digestDate || entryRow?.digestDate || "",
    entryIds: Array.from(existingEntryIds),
    entryCount,
    totalHours,
    distinctMembers: members.length,
    distinctProjects: projects.length,
    members,
    projects,
  };
}

async function fetchTimeEntryForDigest(sql, { accountId, entryId }) {
  const rows = await sql`
    SELECT
      e.id,
      e.user_id AS "userId",
      e.user_name AS "memberName",
      e.entry_date AS "entryDate",
      p.client_id AS "clientId",
      e.client_name AS "clientName",
      e.project_name AS "projectName",
      e.project_id AS "projectId",
      e.charge_center_id AS "chargeCenterId",
      e.hours
    FROM entries e
    LEFT JOIN projects p
      ON p.id = e.project_id
     AND p.account_id = e.account_id
    WHERE e.account_id = ${accountId}::uuid
      AND e.id = ${entryId}
      AND e.deleted_at IS NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const digestDate = normalizeDigestDate(row.entryDate);
  if (!digestDate) return null;
  return {
    id: `${row.id || ""}`.trim(),
    userId: `${row.userId || ""}`.trim() || null,
    memberName: `${row.memberName || ""}`.trim() || "Unknown member",
    digestDate,
    clientId:
      row.clientId === null || row.clientId === undefined || `${row.clientId}`.trim() === ""
        ? null
        : Number(row.clientId),
    clientName: `${row.clientName || ""}`.trim(),
    projectName: `${row.projectName || ""}`.trim(),
    projectId:
      row.projectId === null || row.projectId === undefined || `${row.projectId}`.trim() === ""
        ? null
        : Number(row.projectId),
    chargeCenterId:
      row.chargeCenterId === null ||
      row.chargeCenterId === undefined ||
      `${row.chargeCenterId}`.trim() === ""
        ? null
        : `${row.chargeCenterId}`.trim(),
    hours: Number(row.hours || 0),
  };
}

function normalizePermissionGroup(rawValue, labelValue, levelValue) {
  const raw = `${rawValue || ""}`.trim().toLowerCase();
  const label = `${labelValue || ""}`.trim().toLowerCase();
  const level = Number(levelValue);
  if (!raw && !label) {
    if (Number.isFinite(level) && level >= 6) return "admin";
    if (Number.isFinite(level) && level >= 5) return "executive";
    if (Number.isFinite(level) && level >= 3) return "manager";
    return "staff";
  }
  if (raw === "superuser") return "superuser";
  if (raw === "admin" || raw === "partner" || raw === "principal") return "admin";
  if (raw === "executive" || raw === "director") return "executive";
  if (raw === "manager" || raw === "lead") return "manager";
  if (label.includes("superuser")) return "superuser";
  if (
    label.includes("admin") ||
    label.includes("partner") ||
    label.includes("principal")
  ) {
    return "admin";
  }
  if (label.includes("executive") || label.includes("director")) return "executive";
  if (label.includes("manager") || label.includes("lead")) return "manager";
  return "staff";
}

async function listTimeDigestRecipientUserIdsByVisibility(sql, { accountId, actorUserId, entryRow }) {
  if (!accountId || !entryRow) return [];
  const actorId = `${actorUserId || ""}`.trim();
  const recipientRows = await sql`
    SELECT
      u.id,
      u.role,
      u.level,
      ll.label AS "levelLabel",
      ll.permission_group AS "permissionGroup"
    FROM users u
    LEFT JOIN level_labels ll
      ON ll.account_id = u.account_id
     AND ll.level = u.level
    WHERE u.account_id = ${accountId}::uuid
      AND u.is_active = TRUE
  `;
  const recipients = new Set();
  const managerLikeIds = [];
  for (const row of recipientRows) {
    const userId = `${row?.id || ""}`.trim();
    if (!userId || (actorId && userId === actorId)) continue;
    const group = normalizePermissionGroup(
      row?.permissionGroup || row?.role,
      row?.levelLabel,
      row?.level
    );
    if (group === "superuser" || group === "admin") {
      recipients.add(userId);
      continue;
    }
    if (group === "manager" || group === "executive") {
      managerLikeIds.push(userId);
    }
  }
  if (!managerLikeIds.length) {
    return Array.from(recipients);
  }

  const ownerUserId = `${entryRow?.userId || ""}`.trim();
  if (ownerUserId && managerLikeIds.includes(ownerUserId)) {
    recipients.add(ownerUserId);
  }

  const projectId = Number(entryRow?.projectId);
  const clientId = Number(entryRow?.clientId);
  const isInternal = Boolean(entryRow?.chargeCenterId) || !Number.isInteger(projectId);
  if (isInternal) {
    return Array.from(recipients);
  }

  const projectLeadRows = await sql`
    SELECT p.project_lead_id AS "projectLeadId"
    FROM projects p
    JOIN users u
      ON u.id = p.project_lead_id
     AND u.account_id = p.account_id
     AND u.is_active = TRUE
    WHERE p.account_id = ${accountId}::uuid
      AND p.id = ${projectId}
    LIMIT 1
  `;
  const projectLeadId = `${projectLeadRows?.[0]?.projectLeadId || ""}`.trim();
  if (projectLeadId && (!actorId || projectLeadId !== actorId)) {
    recipients.add(projectLeadId);
  }

  const projectManagerRows = await sql`
    SELECT manager_id AS "managerId"
    FROM manager_projects
    WHERE account_id = ${accountId}::uuid
      AND project_id = ${projectId}
      AND manager_id = ANY(${managerLikeIds})
  `;
  projectManagerRows.forEach((row) => {
    const managerId = `${row?.managerId || ""}`.trim();
    if (managerId) recipients.add(managerId);
  });

  const memberRows = await sql`
    SELECT user_id AS "userId"
    FROM project_members
    WHERE account_id = ${accountId}::uuid
      AND project_id = ${projectId}
      AND user_id = ANY(${managerLikeIds})
  `;
  memberRows.forEach((row) => {
    const managerId = `${row?.userId || ""}`.trim();
    if (managerId) recipients.add(managerId);
  });

  if (Number.isInteger(clientId)) {
    const clientManagerRows = await sql`
      SELECT manager_id AS "managerId"
      FROM manager_clients
      WHERE account_id = ${accountId}::uuid
        AND client_id = ${clientId}
        AND manager_id = ANY(${managerLikeIds})
    `;
    clientManagerRows.forEach((row) => {
      const managerId = `${row?.managerId || ""}`.trim();
      if (managerId) recipients.add(managerId);
    });
  }

  return Array.from(recipients);
}

async function upsertTimeEntryDailyDigestInboxItems(sql, payload = {}, recipientUserIds = []) {
  const accountId = payload.accountId;
  const actorUserId = `${payload.actorUserId || ""}`.trim() || null;
  const entryId = `${payload.subjectId || ""}`.trim();
  const recipients = Array.from(
    new Set((Array.isArray(recipientUserIds) ? recipientUserIds : []).map((id) => `${id || ""}`.trim()).filter(Boolean))
  );
  if (!accountId || !entryId || !recipients.length) return;

  const entryRow = await fetchTimeEntryForDigest(sql, { accountId, entryId });
  if (!entryRow) return;
  const digestDate = entryRow.digestDate;

  for (const recipientUserId of recipients) {
    const existingRows = await sql`
      SELECT id, deep_link_json AS "deepLinkJson"
      FROM inbox_items
      WHERE account_id = ${accountId}::uuid
        AND recipient_user_id = ${recipientUserId}
        AND type = ${TIME_DAILY_DIGEST_TYPE}
        AND subject_type = ${TIME_DAILY_DIGEST_SUBJECT_TYPE}
        AND subject_id = ${digestDate}
        AND is_deleted = FALSE
      ORDER BY created_at DESC
    `;
    const existing = existingRows[0] || null;
    const staleIds = existingRows
      .slice(1)
      .map((row) => `${row?.id || ""}`.trim())
      .filter(Boolean);
    if (staleIds.length) {
      await sql`
        UPDATE inbox_items
        SET is_deleted = TRUE
        WHERE account_id = ${accountId}::uuid
          AND id = ANY(${staleIds})
      `;
    }
    const existingDeepLink = parseJsonObject(existing?.deepLinkJson);
    const previousDigest = parseJsonObject(existingDeepLink?.digest);
    const nextDigest = mergeTimeDigestEntry(previousDigest, entryRow);
    nextDigest.digestDate = digestDate;
    const deepLink = buildTimeDigestDeepLink({
      digestDate,
      entryIds: nextDigest.entryIds,
      members: nextDigest.members,
      projects: nextDigest.projects,
      entryCount: Number(nextDigest.entryCount || 0),
      totalHours: Number(nextDigest.totalHours || 0),
    });
    const message = buildTimeDigestMessage({
      entryCount: Number(nextDigest.entryCount || 0),
      totalHours: Number(nextDigest.totalHours || 0),
      memberCount: Number(nextDigest.distinctMembers || 0),
      projectCount: Number(nextDigest.distinctProjects || 0),
    });
    const noteSnippet = normalizeNoteSnippet(
      buildTimeDigestNote({
        members: nextDigest.members,
        projects: nextDigest.projects,
      }),
      400
    );
    if (existing?.id) {
      await sql`
        UPDATE inbox_items
        SET
          actor_user_id = ${actorUserId},
          message = ${message},
          note_snippet = ${noteSnippet},
          deep_link_json = ${JSON.stringify(deepLink)}::jsonb,
          is_read = FALSE,
          created_at = NOW()
        WHERE id = ${existing.id}
      `;
      continue;
    }
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
        ${TIME_DAILY_DIGEST_TYPE},
        ${recipientUserId},
        ${actorUserId},
        ${TIME_DAILY_DIGEST_SUBJECT_TYPE},
        ${digestDate},
        ${message},
        ${noteSnippet},
        FALSE,
        NULL,
        ${JSON.stringify(deepLink)}::jsonb
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

  const suppressInboxRecipientSet = new Set(
    (Array.isArray(payload.suppressInboxRecipientUserIds)
      ? payload.suppressInboxRecipientUserIds
      : []
    )
      .map((id) => `${id || ""}`.trim())
      .filter(Boolean)
  );

  if (eventType === "time_entry_created") {
    if (deliverInbox) {
      const entryRow = await fetchTimeEntryForDigest(sql, {
        accountId,
        entryId: payload.subjectId,
      });
      if (entryRow) {
        const recipientUserIds = await listTimeDigestRecipientUserIdsByVisibility(sql, {
          accountId,
          actorUserId: payload.actorUserId,
          entryRow,
        });
        const filteredRecipientUserIds = suppressInboxRecipientSet.size
          ? recipientUserIds.filter((id) => !suppressInboxRecipientSet.has(`${id || ""}`.trim()))
          : recipientUserIds;
        if (filteredRecipientUserIds.length) {
          await upsertTimeEntryDailyDigestInboxItems(sql, payload, filteredRecipientUserIds);
        }
      }
    }
    if (deliverEmail) {
      const recipientUserIds = await resolveRecipientsByScope(sql, payload, rule);
      if (recipientUserIds.length) {
        await deliverNotificationEmails(sql, payload, recipientUserIds);
      }
    }
    return;
  }

  const recipientUserIds = await resolveRecipientsByScope(sql, payload, rule);
  if (!recipientUserIds.length) return;
  const inboxRecipientUserIds = suppressInboxRecipientSet.size
    ? recipientUserIds.filter((id) => !suppressInboxRecipientSet.has(`${id || ""}`.trim()))
    : recipientUserIds;

  if (deliverInbox && inboxRecipientUserIds.length) {
    await createSystemInboxItems(sql, {
      ...payload,
      recipientUserIds: inboxRecipientUserIds,
    });
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
