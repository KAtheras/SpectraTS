"use strict";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isClosed(project) {
  return ["closed_out", "completed"].includes(
    text(project?.lifecycleStatus || project?.lifecycle_status).toLowerCase()
  );
}

function matchesProjectStatus(project, statusMode) {
  if (statusMode === "closed") return isClosed(project);
  return !isClosed(project) && project?.isActive !== false && project?.is_active !== false;
}

function realization(actual, standard) {
  return standard > 0 ? (actual / standard) * 100 : null;
}

function resolvedTitle(user, levelLabels) {
  const explicit = text(user?.profileTitle || user?.member_profile_title || user?.title || user?.jobTitle);
  if (explicit) return explicit;
  const profile = text(user?.memberProfile || user?.member_profile);
  const titleLine = profile.split(/\r?\n/).find((line) => /^title\s*:/i.test(line.trim()));
  if (titleLine) return text(titleLine.split(":").slice(1).join(":"));
  return text(levelLabels?.[Number(user?.level)]?.label) || "Unassigned";
}

function monthRange(first, last) {
  if (!first || !last) return [];
  const months = [];
  let cursor = `${first.slice(0, 7)}-01`;
  const end = `${last.slice(0, 7)}-01`;
  while (cursor <= end) {
    months.push(cursor);
    const date = new Date(`${cursor}T00:00:00.000Z`);
    cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  }
  return months;
}

function groupIdentity(project, groupBy, lookups) {
  if (groupBy === "project") {
    const id = text(project.id);
    return { key: `project::${id || "unassigned"}`, name: text(project.name) || "Unassigned" };
  }
  if (groupBy === "office") {
    const client = lookups.clients.get(text(project.clientId || project.client_id)) || {};
    const id = text(project.officeId || project.office_id || client.officeId || client.office_id);
    const name = lookups.offices.get(id) || "Unassigned";
    return { key: `office::${id || "unassigned"}`, name };
  }
  if (groupBy === "department") {
    const id = text(project.projectDepartmentId || project.project_department_id);
    const name = lookups.departments.get(id) || "Unassigned";
    return { key: `department::${id || "unassigned"}`, name };
  }
  const id = text(project.clientId || project.client_id);
  const name = text(project.client) || text(lookups.clients.get(id)?.name) || "Unassigned";
  return { key: `client::${id || "unassigned"}`, name };
}

function projectTargetRealization(project, lookups, targetByOrg) {
  const explicit = nullableNumber(project?.targetRealizationPct ?? project?.target_realization_pct);
  if (explicit !== null) return explicit;
  const client = lookups.clients.get(text(project?.clientId || project?.client_id)) || {};
  const officeId = text(project?.officeId || project?.office_id || client?.officeId || client?.office_id);
  const departmentId = text(project?.projectDepartmentId || project?.project_department_id);
  return targetByOrg.get(`${officeId}::${departmentId}`) ?? null;
}

async function buildRealizationResult(sql, details) {
  const { accountId, filters, shell, visibleProjectIds } = details;
  const safeVisibleIds = visibleProjectIds.length ? visibleProjectIds : [0];
  const officeId = text(filters.officeId);
  const departmentId = text(filters.departmentId);
  const memberId = text(filters.memberId);
  const memberTitle = text(filters.memberTitle).toLowerCase();
  const allUsers = [...(shell.users || []), ...(shell.inactiveUsers || [])];
  const titleUserIds = memberTitle
    ? allUsers.filter((user) => resolvedTitle(user, shell.levelLabels || {}).toLowerCase() === memberTitle).map((user) => text(user.id)).filter(Boolean)
    : ["__all__"];
  const safeTitleUserIds = titleUserIds.length ? titleUserIds : ["__none__"];
  const clientId = /^\d+$/.test(filters.clientId) ? filters.clientId : "0";
  const projectId = /^\d+$/.test(filters.projectId) ? filters.projectId : "0";
  const clientsById = new Map((shell.clients || []).map((client) => [text(client.id), client]));

  const activityRows = await sql`
    WITH activity AS (
      SELECT p.id AS project_id, e.entry_date AS activity_date
      FROM entries e
      JOIN users u ON (u.id = e.user_id OR LOWER(u.display_name) = LOWER(e.user_name)) AND u.account_id = e.account_id
      JOIN clients c ON LOWER(c.name) = LOWER(e.client_name) AND c.account_id = e.account_id
      JOIN projects p ON p.id = e.project_id OR (e.project_id IS NULL AND p.client_id = c.id AND LOWER(p.name) = LOWER(e.project_name))
      WHERE e.account_id = ${accountId}::uuid AND e.deleted_at IS NULL AND e.charge_center_id IS NULL
        AND p.id = ANY(${safeVisibleIds}::bigint[])
        AND (${officeId} = '' OR COALESCE(p.office_id, c.office_id, u.office_id, '') = ${officeId})
        AND (${departmentId} = '' OR COALESCE(p.project_department_id, u.department_id, '') = ${departmentId})
        AND (${memberId} = '' OR u.id = ${memberId})
        AND (${memberTitle} = '' OR u.id = ANY(${safeTitleUserIds}))
        AND (${filters.clientId} = '' OR c.id = ${clientId}::bigint)
        AND (${filters.projectId} = '' OR p.id = ${projectId}::bigint)
      UNION ALL
      SELECT p.id, x.expense_date::date
      FROM expenses x
      JOIN users u ON u.id = x.user_id AND u.account_id = x.account_id
      JOIN clients c ON LOWER(c.name) = LOWER(x.client_name) AND c.account_id = x.account_id
      JOIN projects p ON p.client_id = c.id AND LOWER(p.name) = LOWER(x.project_name)
      WHERE x.account_id = ${accountId}::uuid AND x.deleted_at IS NULL
        AND p.id = ANY(${safeVisibleIds}::bigint[])
        AND (${officeId} = '' OR COALESCE(p.office_id, c.office_id, u.office_id, '') = ${officeId})
        AND (${departmentId} = '' OR COALESCE(p.project_department_id, u.department_id, '') = ${departmentId})
        AND (${memberId} = '' OR u.id = ${memberId})
        AND (${memberTitle} = '' OR u.id = ANY(${safeTitleUserIds}))
        AND (${filters.clientId} = '' OR c.id = ${clientId}::bigint)
        AND (${filters.projectId} = '' OR p.id = ${projectId}::bigint)
    )
    SELECT project_id AS "projectId", TO_CHAR(MAX(activity_date), 'YYYY-MM-DD') AS "lastActivity"
    FROM activity GROUP BY project_id
  `;
  const activityByProject = new Map(activityRows.map((row) => [text(row.projectId), row]));
  const projects = (shell.projects || []).filter((project) => {
    const id = text(project.id);
    if (!matchesProjectStatus(project, filters.statusMode)) return false;
    if (filters.projectId && id !== text(filters.projectId)) return false;
    if (filters.clientId && text(project.clientId || project.client_id) !== text(filters.clientId)) return false;
    const client = clientsById.get(text(project.clientId || project.client_id)) || {};
    const projectOfficeId = text(project.officeId || project.office_id || client.officeId || client.office_id);
    if (officeId && projectOfficeId !== officeId) return false;
    const projectDepartmentId = text(project.projectDepartmentId || project.project_department_id);
    if (departmentId && projectDepartmentId !== departmentId) return false;
    return true;
  });
  const eligibleIds = projects.map((project) => Number(project.id)).filter(Number.isFinite);
  if (!eligibleIds.length) {
    return { kpis: { avgRealizationPct: null, targetRealizationPct: null, actualRevenue: 0, standardRevenue: 0, variance: 0, projectCount: 0, belowTargetProjectCount: 0, limitedForecastCount: 0 }, rows: [], monthlyByKey: {}, months: [] };
  }

  const metricRows = await sql`
    WITH metrics AS (
      SELECT p.id AS project_id, TO_CHAR(DATE_TRUNC('month', e.entry_date), 'YYYY-MM-01') AS month,
        SUM(CASE WHEN LOWER(COALESCE(p.pricing_model, 'fixed')) = 'time_and_materials' AND e.billable
          THEN e.hours * COALESCE(pm.charge_rate_override, mp.charge_rate_override, u.base_rate, 0) ELSE 0 END)::FLOAT8 AS actual,
        SUM(e.hours * COALESCE(u.base_rate, 0))::FLOAT8 AS standard
      FROM entries e
      JOIN users u ON (u.id = e.user_id OR LOWER(u.display_name) = LOWER(e.user_name)) AND u.account_id = e.account_id
      JOIN clients c ON LOWER(c.name) = LOWER(e.client_name) AND c.account_id = e.account_id
      JOIN projects p ON p.id = e.project_id OR (e.project_id IS NULL AND p.client_id = c.id AND LOWER(p.name) = LOWER(e.project_name))
      LEFT JOIN project_members pm ON pm.account_id = e.account_id AND pm.project_id = p.id AND pm.user_id = u.id
      LEFT JOIN manager_projects mp ON mp.account_id = e.account_id AND mp.project_id = p.id AND mp.manager_id = u.id
      WHERE e.account_id = ${accountId}::uuid AND e.deleted_at IS NULL AND e.charge_center_id IS NULL
        AND p.id = ANY(${eligibleIds}::bigint[])
        AND (${memberId} = '' OR u.id = ${memberId})
        AND (${memberTitle} = '' OR u.id = ANY(${safeTitleUserIds}))
      GROUP BY p.id, DATE_TRUNC('month', e.entry_date)
      UNION ALL
      SELECT p.id, SUBSTRING(x.expense_date, 1, 7) || '-01',
        SUM(CASE WHEN LOWER(COALESCE(p.pricing_model, 'fixed')) = 'time_and_materials' AND x.is_billable <> 0 THEN x.amount ELSE 0 END)::FLOAT8,
        SUM(CASE WHEN LOWER(COALESCE(p.pricing_model, 'fixed')) = 'time_and_materials' AND x.is_billable <> 0 THEN x.amount ELSE 0 END)::FLOAT8
      FROM expenses x
      JOIN users u ON u.id = x.user_id AND u.account_id = x.account_id
      JOIN clients c ON LOWER(c.name) = LOWER(x.client_name) AND c.account_id = x.account_id
      JOIN projects p ON p.client_id = c.id AND LOWER(p.name) = LOWER(x.project_name)
      WHERE x.account_id = ${accountId}::uuid AND x.deleted_at IS NULL AND p.id = ANY(${eligibleIds}::bigint[])
        AND (${memberId} = '' OR u.id = ${memberId})
        AND (${memberTitle} = '' OR u.id = ANY(${safeTitleUserIds}))
      GROUP BY p.id, SUBSTRING(x.expense_date, 1, 7)
    )
    SELECT project_id AS "projectId", month, SUM(actual)::FLOAT8 AS actual, SUM(standard)::FLOAT8 AS standard
    FROM metrics GROUP BY project_id, month ORDER BY project_id, month
  `;

  const metricsByProject = new Map();
  metricRows.forEach((row) => {
    const id = text(row.projectId);
    if (!metricsByProject.has(id)) metricsByProject.set(id, []);
    metricsByProject.get(id).push({ month: row.month, actual: number(row.actual), standard: number(row.standard) });
  });
  const usersById = new Map(allUsers.map((user) => [text(user.id), user]));
  const budgetsByProject = new Map();
  (shell.projectMemberBudgets || []).forEach((budget) => {
    const id = text(budget.projectId);
    if (!eligibleIds.includes(Number(id))) return;
    if (memberId && text(budget.userId) !== memberId) return;
    const user = usersById.get(text(budget.userId)) || {};
    const title = resolvedTitle(user, shell.levelLabels || {}).toLowerCase();
    if (memberTitle && title !== memberTitle) return;
    const hours = number(budget.budgetHours);
    const base = number(user.baseRate ?? user.base_rate);
    const rate = nullableNumber(budget.rateOverride) ?? base;
    const target = budgetsByProject.get(id) || { standard: 0, planned: 0 };
    target.standard += hours * base;
    target.planned += hours * rate;
    budgetsByProject.set(id, target);
  });
  const lookups = {
    offices: new Map((shell.officeLocations || []).map((row) => [text(row.id), text(row.name)])),
    departments: new Map((shell.departments || []).map((row) => [text(row.id), text(row.name)])),
    clients: new Map((shell.clients || []).map((row) => [text(row.id), row])),
  };
  const targetByOrg = new Map(
    (shell.targetRealizations || []).map((row) => [
      `${text(row.officeId || row.office_id)}::${text(row.departmentId || row.department_id)}`,
      nullableNumber(row.targetRealizationPct ?? row.target_realization_pct),
    ])
  );
  const grouped = new Map();
  let limitedForecastCount = 0;
  let belowTargetProjectCount = 0;
  let targetWeightedValue = 0;
  let targetWeight = 0;
  const includedMonths = [];
  projects.forEach((project) => {
    const id = text(project.id);
    const samples = metricsByProject.get(id) || [];
    let actual = samples.reduce((sum, row) => sum + row.actual, 0);
    let standard = samples.reduce((sum, row) => sum + row.standard, 0);
    const lastActivity = text(activityByProject.get(id)?.lastActivity);
    const lastMonth = samples.at(-1)?.month || (lastActivity ? `${lastActivity.slice(0, 7)}-01` : `${filters.to.slice(0, 7)}-01`);
    if (text(project.pricingModel || project.pricing_model).toLowerCase() !== "time_and_materials") {
      actual += number(project.contractAmount ?? project.contract_amount);
      if (actual) samples.push({ month: lastMonth, actual: number(project.contractAmount ?? project.contract_amount), standard: 0 });
    }
    if (!isClosed(project)) {
      const plan = budgetsByProject.get(id);
      const percent = nullableNumber(project.percentComplete ?? project.percent_complete);
      const budget = nullableNumber(project.budget);
      let forecastStandard = standard;
      if (plan?.standard > 0) forecastStandard = Math.max(standard, plan.standard);
      else if (percent > 0 && percent < 100) forecastStandard = standard / (percent / 100);
      else if (budget > 0) { forecastStandard = Math.max(standard, budget); limitedForecastCount += 1; }
      else limitedForecastCount += 1;
      const fixed = text(project.pricingModel || project.pricing_model).toLowerCase() !== "time_and_materials";
      const forecastActual = fixed ? (number(project.contractAmount ?? project.contract_amount) || number(project.budget)) : Math.max(actual, number(plan?.planned));
      samples.push({ month: lastMonth, actual: forecastActual - actual, standard: forecastStandard - standard });
      actual = forecastActual;
      standard = forecastStandard;
    }
    const targetPct = projectTargetRealization(project, lookups, targetByOrg);
    if (targetPct !== null && standard > 0) {
      targetWeightedValue += targetPct * standard;
      targetWeight += standard;
      if ((realization(actual, standard) ?? Infinity) < targetPct) belowTargetProjectCount += 1;
    }
    const identity = groupIdentity(project, filters.groupBy, lookups);
    if (!grouped.has(identity.key)) grouped.set(identity.key, { ...identity, actual: 0, standard: 0, targetWeightedValue: 0, targetWeight: 0, months: new Map() });
    const target = grouped.get(identity.key);
    target.actual += actual;
    target.standard += standard;
    if (targetPct !== null && standard > 0) {
      target.targetWeightedValue += targetPct * standard;
      target.targetWeight += standard;
    }
    samples.forEach((sample) => {
      if (!sample.month) return;
      includedMonths.push(sample.month);
      const month = target.months.get(sample.month) || { actual: 0, standard: 0 };
      month.actual += sample.actual;
      month.standard += sample.standard;
      target.months.set(sample.month, month);
    });
  });
  const rows = Array.from(grouped.values()).map((row) => ({
    key: row.key,
    name: row.name,
    actualRevenue: row.actual,
    standardRevenue: row.standard,
    realizationPct: realization(row.actual, row.standard),
    targetRealizationPct: row.targetWeight > 0 ? row.targetWeightedValue / row.targetWeight : null,
    months: row.months,
  }));
  rows.sort((a, b) => (b.realizationPct ?? -1) - (a.realizationPct ?? -1) || b.actualRevenue - a.actualRevenue || a.name.localeCompare(b.name));
  const monthlyByKey = {};
  rows.forEach((row) => {
    const active = Array.from(row.months.keys()).sort();
    let actual = 0;
    let standard = 0;
    monthlyByKey[row.key] = monthRange(active[0], active.at(-1)).map((month) => {
      const sample = row.months.get(month) || { actual: 0, standard: 0 };
      actual += sample.actual;
      standard += sample.standard;
      return { month, actualRevenue: actual, standardRevenue: standard, realizationPct: realization(actual, standard), targetRealizationPct: row.targetRealizationPct };
    });
  });
  const actualRevenue = rows.reduce((sum, row) => sum + row.actualRevenue, 0);
  const standardRevenue = rows.reduce((sum, row) => sum + row.standardRevenue, 0);
  return {
    kpis: {
      avgRealizationPct: realization(actualRevenue, standardRevenue),
      targetRealizationPct: targetWeight > 0 ? targetWeightedValue / targetWeight : null,
      actualRevenue,
      standardRevenue,
      variance: actualRevenue - standardRevenue,
      projectCount: projects.length,
      belowTargetProjectCount,
      limitedForecastCount,
    },
    rows: rows.map(({ months, ...row }) => row),
    monthlyByKey,
    months: Array.from(new Set(includedMonths)).sort(),
  };
}

module.exports = { buildRealizationResult, isClosed, matchesProjectStatus, monthRange, projectTargetRealization, realization };
