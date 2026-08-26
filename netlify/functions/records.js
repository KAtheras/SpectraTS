"use strict";

const {
  errorResponse,
  getSessionContext,
  getSql,
  json,
  loadState,
  requireAuth,
} = require("./_db");
const { can, buildIndex, loadPermissionsFromDb } = require("./permissions");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    return parsed && parsed.date && parsed.createdAt && parsed.id ? parsed : null;
  } catch (_) {
    return null;
  }
}

function encodeCursor(row, dateKey) {
  return Buffer.from(JSON.stringify({
    date: row[dateKey],
    createdAt: row.createdAt,
    id: row.id,
  })).toString("base64url");
}

function parseRecordsQuery(query = {}) {
  const type = query.type === "expenses" ? "expenses" : query.type === "entries" ? "entries" : "";
  const from = String(query.from || "");
  const to = String(query.to || "");
  if (!type || !isIsoDate(from) || !isIsoDate(to) || from > to) return null;
  const cursor = decodeCursor(query.cursor);
  if (query.cursor && !cursor) return null;
  const requestedLimit = Number.parseInt(query.limit, 10);
  return {
    type,
    from,
    to,
    limit: Math.min(250, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 100)),
    cursor,
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") return errorResponse(405, "Method not allowed.");
  try {
    const startedAt = Date.now();
    const query = event.queryStringParameters || {};
    const parsedQuery = parseRecordsQuery(query);
    if (!parsedQuery) {
      return errorResponse(400, "type, from, and to are required.");
    }
    const { type, from, to, limit, cursor } = parsedQuery;

    const sql = await getSql();
    const context = await getSessionContext(sql, event);
    const authError = requireAuth(context);
    if (authError) return authError;

    const shell = await loadState(sql, context.currentUser, { includeRecords: false });
    const accountId = shell.account.id;
    const userId = context.currentUser.id;
    const userName = String(context.currentUser.displayName || context.currentUser.display_name || "");
    const actorOfficeId = context.currentUser.officeId ?? context.currentUser.office_id ?? null;
    const permissions = buildIndex({ permissions: await loadPermissionsFromDb(sql) });
    const outsideOffice = actorOfficeId ? `__outside_office__${actorOfficeId}` : "__outside_office__";
    const canViewAll = can(context.currentUser, "view_all_entries", {
      resourceOfficeId: outsideOffice,
      actorOfficeId,
    }, permissions);
    const isAdmin = ["admin", "superuser"].includes(String(shell.currentUser.permissionGroup || "").toLowerCase());
    const visibleProjectIds = Array.isArray(shell.visibleProjectIds) && shell.visibleProjectIds.length
      ? shell.visibleProjectIds
      : [0];
    const cursorDate = cursor?.date || "9999-12-31";
    const cursorCreatedAt = cursor?.createdAt || "9999-12-31T23:59:59.999Z";
    const cursorId = cursor?.id || "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const userFilter = String(query.user || "").trim();
    const clientFilter = String(query.client || "").trim();
    const projectFilter = String(query.project || "").trim();
    const statusFilter = String(query.status || "").trim();
    const search = String(query.search || "").trim();

    let rows;
    if (type === "entries") {
      rows = await sql`
        SELECT entries.id, entries.user_name AS "user", u.id AS "userId",
          TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
          CASE WHEN entries.charge_center_id IS NOT NULL THEN 'Internal' ELSE COALESCE(clients.name, entries.client_name, 'Internal') END AS client,
          CASE WHEN entries.charge_center_id IS NOT NULL THEN COALESCE(cfc.name, entries.project_name, 'Internal') ELSE COALESCE(projects.name, entries.project_name, 'Internal') END AS project,
          entries.project_id AS "projectId", entries.charge_center_id AS "chargeCenterId",
          entries.task, entries.hours::FLOAT8 AS hours, entries.notes, entries.billable,
          entries.status, entries.created_at AS "createdAt", entries.updated_at AS "updatedAt"
        FROM entries
        LEFT JOIN users u ON (u.id = entries.user_id OR LOWER(u.display_name) = LOWER(entries.user_name)) AND u.account_id = entries.account_id
        LEFT JOIN clients ON LOWER(clients.name) = LOWER(entries.client_name) AND clients.account_id = entries.account_id
        LEFT JOIN projects ON projects.id = entries.project_id OR (entries.project_id IS NULL AND projects.client_id = clients.id AND LOWER(projects.name) = LOWER(entries.project_name))
        LEFT JOIN corporate_function_categories cfc ON cfc.id = entries.charge_center_id AND cfc.account_id = entries.account_id
        WHERE entries.account_id = ${accountId}::uuid AND entries.deleted_at IS NULL
          AND entries.entry_date BETWEEN ${from}::date AND ${to}::date
          AND (${canViewAll} OR entries.user_id = ${userId} OR LOWER(entries.user_name) = LOWER(${userName}) OR projects.id = ANY(${visibleProjectIds}::bigint[]))
          AND (${isAdmin} OR entries.charge_center_id IS NULL OR entries.user_id = ${userId} OR LOWER(entries.user_name) = LOWER(${userName}))
          AND (${userFilter} = '' OR entries.user_id::text = ${userFilter} OR LOWER(entries.user_name) = LOWER(${userFilter}))
          AND (${clientFilter} = '' OR LOWER(COALESCE(clients.name, entries.client_name, 'Internal')) = LOWER(${clientFilter}))
          AND (${projectFilter} = '' OR entries.project_id::text = ${projectFilter} OR LOWER(COALESCE(projects.name, entries.project_name, 'Internal')) = LOWER(${projectFilter}))
          AND (${statusFilter} = '' OR LOWER(entries.status) = LOWER(${statusFilter}))
          AND (${search} = '' OR entries.notes ILIKE ${`%${search}%`} OR entries.task ILIKE ${`%${search}%`})
          AND (entries.entry_date, entries.created_at, entries.id) < (${cursorDate}::date, ${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)
        ORDER BY entries.entry_date DESC, entries.created_at DESC, entries.id DESC
        LIMIT ${limit + 1}
      `;
    } else {
      rows = await sql`
        SELECT expenses.id, expenses.user_id AS "userId", expenses.client_name AS "clientName",
          expenses.project_name AS "projectName", expenses.expense_date AS "expenseDate",
          expenses.category, expenses.amount::FLOAT8 AS amount, expenses.is_billable AS "isBillable",
          COALESCE(expenses.notes, '') AS notes, expenses.status, expenses.approved_at AS "approvedAt",
          COALESCE(expenses.created_at, '') AS "createdAt", expenses.updated_at AS "updatedAt"
        FROM expenses
        LEFT JOIN clients ON LOWER(clients.name) = LOWER(expenses.client_name) AND clients.account_id = expenses.account_id
        LEFT JOIN projects ON projects.client_id = clients.id AND LOWER(projects.name) = LOWER(expenses.project_name)
        WHERE expenses.account_id = ${accountId}::uuid AND expenses.deleted_at IS NULL
          AND expenses.expense_date BETWEEN ${from} AND ${to}
          AND (${canViewAll} OR expenses.user_id = ${userId} OR projects.id = ANY(${visibleProjectIds}::bigint[]))
          AND (${isAdmin} OR LOWER(expenses.client_name) <> 'internal' OR expenses.user_id = ${userId})
          AND (${userFilter} = '' OR expenses.user_id::text = ${userFilter})
          AND (${clientFilter} = '' OR LOWER(expenses.client_name) = LOWER(${clientFilter}))
          AND (${projectFilter} = '' OR LOWER(expenses.project_name) = LOWER(${projectFilter}))
          AND (${statusFilter} = '' OR LOWER(expenses.status) = LOWER(${statusFilter}))
          AND (${search} = '' OR expenses.notes ILIKE ${`%${search}%`} OR expenses.category ILIKE ${`%${search}%`})
          AND (expenses.expense_date, COALESCE(expenses.created_at, ''), expenses.id) < (${cursorDate}, ${cursorCreatedAt}, ${cursorId})
        ORDER BY expenses.expense_date DESC, COALESCE(expenses.created_at, '') DESC, expenses.id DESC
        LIMIT ${limit + 1}
      `;
    }
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return json(200, {
      items,
      page: { limit, hasMore, nextCursor: hasMore && last ? encodeCursor(last, type === "entries" ? "date" : "expenseDate") : null },
    }, {
      "Server-Timing": `app;dur=${Date.now() - startedAt}`,
      "X-Result-Count": String(items.length),
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load records.");
  }
};

exports._test = { decodeCursor, encodeCursor, isIsoDate, parseRecordsQuery };
