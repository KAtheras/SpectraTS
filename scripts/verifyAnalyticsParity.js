"use strict";

const db = require("../netlify/functions/_db");
const engine = require("../analyticsEngine");
const utilization = require("../netlify/functions/_analyticsUtilization");
const realization = require("../netlify/functions/_analyticsRealization");

const numericDiff = (left, right) => Math.abs(Number(left || 0) - Number(right || 0));
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));

async function main() {
  const sql = await db.getSql();
  const users = await sql`
    SELECT u.id, u.username, u.display_name AS "displayName", u.role, u.level,
      u.office_id AS "officeId", u.department_id AS "departmentId", u.account_id AS "accountId"
    FROM users u
    WHERE NULLIF(TRIM(u.role), '') IS NOT NULL
    ORDER BY CASE WHEN LOWER(u.role) IN ('global_admin', 'superuser') THEN 0 ELSE 1 END, u.created_at
    LIMIT 1
  `;
  if (!users[0]) throw new Error("No configured user is available for verification.");

  const loadStartedAt = Date.now();
  const full = await db.loadState(sql, users[0], { includeRecords: true });
  const legacyLoadMs = Date.now() - loadStartedAt;
  const dates = [
    ...(full.entries || []).map((row) => row.date),
    ...(full.expenses || []).map((row) => row.expenseDate),
  ].filter(Boolean).sort();
  if (!dates.length) throw new Error("No analytics records are available for verification.");

  const latest = dates.at(-1);
  const from = `${latest.slice(0, 7)}-01`;
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  const to = end.toISOString().slice(0, 10);
  const utilizationFilters = {
    fromDate: from,
    toDate: to,
    period: "this_month",
    groupBy: "member",
    officeId: "",
    departmentId: "",
  };
  const legacyUtilization = engine.computeUtilizationAnalytics({
    entries: full.utilizationEntries?.length ? full.utilizationEntries : full.entries,
    users: full.utilizationUsers?.length
      ? full.utilizationUsers
      : [...(full.users || []), ...(full.inactiveUsers || [])],
    currentUser: full.currentUser,
    utilizationScope: full.utilizationScope,
    departmentLeadAssignments: full.departmentLeadAssignments,
    projects: full.projects,
    clients: full.clients,
    offices: full.officeLocations,
    departments: full.departments,
    corporateFunctionCategories: full.corporateFunctionCategories,
    levelLabels: full.levelLabels,
    filters: utilizationFilters,
  });
  const utilizationShellStartedAt = Date.now();
  const utilizationShell = await db.loadUtilizationAnalyticsShell(sql, users[0]);
  const utilizationShellMs = Date.now() - utilizationShellStartedAt;
  const utilizationStartedAt = Date.now();
  const serverUtilization = await utilization.buildUtilizationResult(sql, {
    accountId: full.account.id,
    shell: utilizationShell,
    filters: { from, to, period: "this_month", groupBy: "member", officeId: "", departmentId: "" },
  });
  const utilizationMs = Date.now() - utilizationStartedAt;

  const realizationFilters = {
    fromDate: `${latest.slice(0, 4)}-01-01`,
    toDate: `${latest.slice(0, 4)}-12-31`,
    groupBy: "client",
    officeId: "",
    departmentId: "",
    memberId: "",
    memberTitle: "",
    clientId: "",
    projectId: "",
    statusMode: "combined",
  };
  const normalizedExpenses = (full.expenses || []).map((row) => ({
    ...row,
    isBillable: row.isBillable === true || row.isBillable === 1 || row.isBillable === "1",
  }));
  const legacyRealization = engine.computeRealizationAnalytics({
    entries: full.entries,
    expenses: normalizedExpenses,
    users: full.users,
    projects: full.projects,
    clients: full.clients,
    offices: full.officeLocations,
    departments: full.departments,
    assignments: full.assignments,
    projectMemberBudgets: full.projectMemberBudgets,
    levelLabels: full.levelLabels,
    filters: realizationFilters,
  });
  const realizationStartedAt = Date.now();
  const serverRealization = await realization.buildRealizationResult(sql, {
    accountId: full.account.id,
    shell: full,
    visibleProjectIds: full.visibleProjectIds || [],
    filters: { from: realizationFilters.fromDate, to: realizationFilters.toDate, ...realizationFilters },
  });
  const realizationMs = Date.now() - realizationStartedAt;

  const report = {
    range: { from, to },
    legacyLoadMs,
    legacyRecordCount: (full.entries || []).length + (full.expenses || []).length,
    legacyRecordBytes: bytes({
      entries: full.entries,
      expenses: full.expenses,
      utilizationEntries: full.utilizationEntries,
    }),
    utilization: {
      shellMs: utilizationShellMs,
      queryMs: utilizationMs,
      legacyBytes: bytes(legacyUtilization),
      serverBytes: bytes(serverUtilization),
      kpiDiffs: {
        clientHours: numericDiff(legacyUtilization.kpis.clientHours, serverUtilization.kpis.clientHours),
        internalHours: numericDiff(legacyUtilization.kpis.internalHours, serverUtilization.kpis.internalHours),
        ptoHours: numericDiff(legacyUtilization.kpis.ptoHours, serverUtilization.kpis.ptoHours),
        idleHours: numericDiff(legacyUtilization.kpis.idleHours, serverUtilization.kpis.idleHours),
      },
      legacyKpis: legacyUtilization.kpis,
      serverKpis: serverUtilization.kpis,
      scopedUsers: (full.utilizationUsers || []).length,
      scopedUserLifecycle: (full.utilizationUsers || []).map((user) => ({
        activeFrom: user.activeFrom || user.active_from || "",
        activeTo: user.activeTo || user.active_to || "",
      })),
    },
    realization: {
      queryMs: realizationMs,
      legacyBytes: bytes(legacyRealization),
      serverBytes: bytes(serverRealization),
      kpiDiffs: {
        actualRevenue: numericDiff(legacyRealization.kpis.actualRevenue, serverRealization.kpis.actualRevenue),
        standardRevenue: numericDiff(legacyRealization.kpis.standardRevenue, serverRealization.kpis.standardRevenue),
        projectCount: numericDiff(legacyRealization.kpis.projectCount, serverRealization.kpis.projectCount),
      },
      legacyKpis: legacyRealization.kpis,
      serverKpis: serverRealization.kpis,
    },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  const differences = [
    ...Object.values(report.utilization.kpiDiffs),
    ...Object.values(report.realization.kpiDiffs),
  ];
  const exceedsPerformanceBudget =
    report.utilization.shellMs > 2000 ||
    report.utilization.queryMs > 2000 ||
    report.realization.queryMs > 2000 ||
    report.utilization.serverBytes > 250000 ||
    report.realization.serverBytes > 250000;
  if (differences.some((value) => value > 0.01) || exceedsPerformanceBudget) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
