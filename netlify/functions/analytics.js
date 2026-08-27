"use strict";

const {
  errorResponse,
  getSessionContext,
  getSql,
  json,
  listClients,
  listProjects,
  loadUtilizationAnalyticsShell,
  loadState,
  resolveAnalyticsAuthority,
  requireAuth,
} = require("./_db");
const { buildIndex, loadPermissionsFromDb } = require("./permissions");
const { buildUtilizationResult } = require("./_analyticsUtilization");
const { buildRealizationResult } = require("./_analyticsRealization");

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseQuery(query = {}) {
  const report = String(query.report || "profitability").trim().toLowerCase();
  const from = String(query.from || "");
  const to = String(query.to || "");
  const scope = ["company", "office", "department"].includes(query.scope)
    ? query.scope
    : "company";
  if (!["profitability", "utilization", "realization"].includes(report) || !isIsoDate(from) || !isIsoDate(to) || from > to) return null;
  return {
    report,
    from,
    to,
    scope,
    scopeId: String(query.scopeId || "").trim(),
    clientId: String(query.clientId || "").trim(),
    projectId: String(query.projectId || "").trim(),
    period: String(query.period || "custom").trim().toLowerCase(),
    groupBy: ["member", "title", "office", "department"].includes(query.groupBy) ? query.groupBy : "member",
    officeId: String(query.officeId || "").trim(),
    departmentId: String(query.departmentId || "").trim(),
    memberId: String(query.memberId || "").trim(),
    memberTitle: String(query.memberTitle || "").trim(),
    statusMode: ["open", "closed", "combined"].includes(query.statusMode) ? query.statusMode : "open",
  };
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") return errorResponse(405, "Method not allowed.");
  const startedAt = Date.now();
  try {
    const filters = parseQuery(event.queryStringParameters || {});
    if (!filters) return errorResponse(400, "A valid report, from, and to are required.");

    const sql = await getSql();
    const context = await getSessionContext(sql, event);
    const authError = requireAuth(context);
    if (authError) return authError;

    const permissionRows = await loadPermissionsFromDb(sql);
    const permissionIndex = buildIndex({ permissions: permissionRows });
    const analyticsAuthority = await resolveAnalyticsAuthority(
      sql,
      context.currentUser,
      permissionIndex
    );
    if (!analyticsAuthority.canAccess) {
      return errorResponse(403, "Access denied.");
    }

    if (filters.report === "utilization") {
      const shell = await loadUtilizationAnalyticsShell(sql, context.currentUser, analyticsAuthority);
      const accountId = shell.account.id;
      const data = await buildUtilizationResult(sql, { accountId, filters, shell });
      return json(200, { report: filters.report, filters, data }, {
        "Server-Timing": `app;dur=${Date.now() - startedAt}`,
        "X-Result-Count": String(data.rows.length),
      });
    }
    const shell = await loadState(sql, context.currentUser, { includeRecords: false });
    const accountId = shell.account.id;
    const allAnalyticsProjects = await listProjects(sql, accountId);
    const authorityProjectIdSet = new Set(
      (analyticsAuthority.projectIds || []).map((id) => String(id))
    );
    shell.projects = analyticsAuthority.all
      ? allAnalyticsProjects
      : allAnalyticsProjects.filter((project) => authorityProjectIdSet.has(String(project.id)));
    const analyticsClientIds = new Set(
      shell.projects.map((project) => String(project.clientId || project.client_id || "")).filter(Boolean)
    );
    shell.clients = (await listClients(sql, accountId)).filter((client) =>
      analyticsClientIds.has(String(client.id))
    );
    if (filters.report === "realization") {
      const data = await buildRealizationResult(sql, {
        accountId,
        filters,
        shell,
        visibleProjectIds: analyticsAuthority.all
          ? (shell.projects || []).map((project) => project.id)
          : analyticsAuthority.projectIds,
      });
      return json(200, { report: filters.report, filters, data }, {
        "Server-Timing": `app;dur=${Date.now() - startedAt}`,
        "X-Result-Count": String(data.rows.length),
      });
    }
    const canViewAll = analyticsAuthority.all;
    const visibleProjectIds = analyticsAuthority.all
      ? (shell.projects || []).map((project) => project.id)
      : analyticsAuthority.projectIds.length
        ? analyticsAuthority.projectIds
        : [0];
    const scopeOfficeId = filters.scope === "office" ? filters.scopeId : "";
    const scopeDepartmentId = filters.scope === "department" ? filters.scopeId : "";
    const clientId = /^\d+$/.test(filters.clientId) ? filters.clientId : "0";
    const projectId = /^\d+$/.test(filters.projectId) ? filters.projectId : "0";

    const timeRows = await sql`
      SELECT TO_CHAR(DATE_TRUNC('month', e.entry_date), 'YYYY-MM-01') AS month,
        SUM(CASE WHEN LOWER(COALESCE(p.pricing_model, 'fixed')) = 'time_and_materials' AND e.billable
          THEN e.hours * COALESCE(pm.charge_rate_override, mp.charge_rate_override, u.base_rate, 0) ELSE 0 END)::FLOAT8 AS revenue,
        SUM(e.hours * COALESCE(u.cost_rate, u.base_rate, 0))::FLOAT8 AS cost,
        SUM(e.hours * COALESCE(u.base_rate, 0))::FLOAT8 AS "standardRevenue",
        SUM(e.hours)::FLOAT8 AS hours
      FROM entries e
      JOIN users u ON (u.id = e.user_id OR LOWER(u.display_name) = LOWER(e.user_name)) AND u.account_id = e.account_id
      LEFT JOIN clients c ON LOWER(c.name) = LOWER(e.client_name) AND c.account_id = e.account_id
      LEFT JOIN projects p ON p.id = e.project_id OR (e.project_id IS NULL AND p.client_id = c.id AND LOWER(p.name) = LOWER(e.project_name))
      LEFT JOIN project_members pm ON pm.account_id = e.account_id AND pm.project_id = p.id AND pm.user_id = u.id
      LEFT JOIN manager_projects mp ON mp.account_id = e.account_id AND mp.project_id = p.id AND mp.manager_id = u.id
      WHERE e.account_id = ${accountId}::uuid AND e.deleted_at IS NULL
        AND e.charge_center_id IS NULL AND LOWER(COALESCE(c.name, e.client_name, '')) NOT IN ('internal', 'internal work')
        AND e.entry_date BETWEEN ${filters.from}::date AND ${filters.to}::date
        AND (${canViewAll} OR p.id = ANY(${visibleProjectIds}::bigint[]))
        AND (${scopeOfficeId} = '' OR COALESCE(p.office_id, c.office_id, u.office_id, '') = ${scopeOfficeId})
        AND (${scopeDepartmentId} = '' OR COALESCE(p.project_department_id, u.department_id, '') = ${scopeDepartmentId})
        AND (${filters.clientId} = '' OR c.id = ${clientId}::bigint)
        AND (${filters.projectId} = '' OR p.id = ${projectId}::bigint)
      GROUP BY DATE_TRUNC('month', e.entry_date)
      ORDER BY DATE_TRUNC('month', e.entry_date)
    `;

    const expenseRows = await sql`
      SELECT SUBSTRING(x.expense_date, 1, 7) || '-01' AS month,
        SUM(CASE WHEN LOWER(COALESCE(p.pricing_model, 'fixed')) = 'time_and_materials' AND x.is_billable <> 0
          THEN x.amount ELSE 0 END)::FLOAT8 AS revenue,
        SUM(x.amount)::FLOAT8 AS cost,
        SUM(CASE WHEN LOWER(COALESCE(p.pricing_model, 'fixed')) = 'time_and_materials' AND x.is_billable <> 0
          THEN x.amount ELSE 0 END)::FLOAT8 AS "standardRevenue",
        0::FLOAT8 AS hours
      FROM expenses x
      JOIN users u ON u.id = x.user_id AND u.account_id = x.account_id
      LEFT JOIN clients c ON LOWER(c.name) = LOWER(x.client_name) AND c.account_id = x.account_id
      LEFT JOIN projects p ON p.client_id = c.id AND LOWER(p.name) = LOWER(x.project_name)
      WHERE x.account_id = ${accountId}::uuid AND x.deleted_at IS NULL
        AND LOWER(x.client_name) NOT IN ('internal', 'internal work')
        AND x.expense_date BETWEEN ${filters.from} AND ${filters.to}
        AND (${canViewAll} OR p.id = ANY(${visibleProjectIds}::bigint[]))
        AND (${scopeOfficeId} = '' OR COALESCE(p.office_id, c.office_id, u.office_id, '') = ${scopeOfficeId})
        AND (${scopeDepartmentId} = '' OR COALESCE(p.project_department_id, u.department_id, '') = ${scopeDepartmentId})
        AND (${filters.clientId} = '' OR c.id = ${clientId}::bigint)
        AND (${filters.projectId} = '' OR p.id = ${projectId}::bigint)
      GROUP BY SUBSTRING(x.expense_date, 1, 7)
      ORDER BY SUBSTRING(x.expense_date, 1, 7)
    `;

    const fixedRows = await sql`
      WITH activity_rows AS (
        SELECT p.id AS project_id, e.entry_date AS activity_date
        FROM entries e
        JOIN clients c ON LOWER(c.name) = LOWER(e.client_name) AND c.account_id = e.account_id
        JOIN projects p ON p.id = e.project_id OR (e.project_id IS NULL AND p.client_id = c.id AND LOWER(p.name) = LOWER(e.project_name))
        JOIN users u ON (u.id = e.user_id OR LOWER(u.display_name) = LOWER(e.user_name)) AND u.account_id = e.account_id
        WHERE e.account_id = ${accountId}::uuid AND e.deleted_at IS NULL AND e.charge_center_id IS NULL
          AND e.entry_date BETWEEN ${filters.from}::date AND ${filters.to}::date
          AND LOWER(COALESCE(p.pricing_model, 'fixed')) <> 'time_and_materials'
          AND (${canViewAll} OR p.id = ANY(${visibleProjectIds}::bigint[]))
          AND (${scopeOfficeId} = '' OR COALESCE(p.office_id, c.office_id, u.office_id, '') = ${scopeOfficeId})
          AND (${scopeDepartmentId} = '' OR COALESCE(p.project_department_id, u.department_id, '') = ${scopeDepartmentId})
          AND (${filters.clientId} = '' OR c.id = ${clientId}::bigint)
          AND (${filters.projectId} = '' OR p.id = ${projectId}::bigint)
        UNION ALL
        SELECT p.id AS project_id, x.expense_date::date AS activity_date
        FROM expenses x
        JOIN users u ON u.id = x.user_id AND u.account_id = x.account_id
        JOIN clients c ON LOWER(c.name) = LOWER(x.client_name) AND c.account_id = x.account_id
        JOIN projects p ON p.client_id = c.id AND LOWER(p.name) = LOWER(x.project_name)
        WHERE x.account_id = ${accountId}::uuid AND x.deleted_at IS NULL
          AND x.expense_date BETWEEN ${filters.from} AND ${filters.to}
          AND LOWER(COALESCE(p.pricing_model, 'fixed')) <> 'time_and_materials'
          AND (${canViewAll} OR p.id = ANY(${visibleProjectIds}::bigint[]))
          AND (${scopeOfficeId} = '' OR COALESCE(p.office_id, c.office_id, u.office_id, '') = ${scopeOfficeId})
          AND (${scopeDepartmentId} = '' OR COALESCE(p.project_department_id, u.department_id, '') = ${scopeDepartmentId})
          AND (${filters.clientId} = '' OR c.id = ${clientId}::bigint)
          AND (${filters.projectId} = '' OR p.id = ${projectId}::bigint)
      ), activity AS (
        SELECT project_id, MAX(activity_date) AS activity_date
        FROM activity_rows
        GROUP BY project_id
      )
      SELECT TO_CHAR(DATE_TRUNC('month', activity.activity_date), 'YYYY-MM-01') AS month,
        SUM(p.contract_amount)::FLOAT8 AS revenue
      FROM activity JOIN projects p ON p.id = activity.project_id
      WHERE p.contract_amount > 0
      GROUP BY DATE_TRUNC('month', activity.activity_date)
    `;

    const byMonth = new Map();
    const add = (row) => {
      const month = String(row.month || "");
      if (!month) return;
      const target = byMonth.get(month) || { month, revenue: 0, cost: 0, standardRevenue: 0, totalHours: 0 };
      target.revenue += number(row.revenue);
      target.cost += number(row.cost);
      target.standardRevenue += number(row.standardRevenue);
      target.totalHours += number(row.hours);
      byMonth.set(month, target);
    };
    timeRows.forEach(add);
    expenseRows.forEach(add);
    fixedRows.forEach(add);
    const trend = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
      ...row,
      profit: row.revenue - row.cost,
      realizationPct: row.standardRevenue > 0 ? (row.revenue / row.standardRevenue) * 100 : null,
    }));
    const totals = trend.reduce((sum, row) => ({
      revenue: sum.revenue + row.revenue,
      cost: sum.cost + row.cost,
      standardRevenue: sum.standardRevenue + row.standardRevenue,
      totalHours: sum.totalHours + row.totalHours,
    }), { revenue: 0, cost: 0, standardRevenue: 0, totalHours: 0 });
    const data = {
      kpis: {
        ...totals,
        profit: totals.revenue - totals.cost,
        realizationPct: totals.standardRevenue > 0 ? (totals.revenue / totals.standardRevenue) * 100 : null,
      },
      trend,
      groupedRows: [],
    };
    return json(200, { report: filters.report, filters, data }, {
      "Server-Timing": `app;dur=${Date.now() - startedAt}`,
      "X-Result-Count": String(trend.length),
    });
  } catch (error) {
    return errorResponse(500, error.message || "Unable to load analytics.");
  }
};

exports._test = { isIsoDate, parseQuery };
