"use strict";

const crypto = require("crypto");
const { getSql } = require("../netlify/functions/_db");

const TARGET_ACCOUNT_NAME = "ACME Inc.";
const TARGET_ACCOUNT_ID = "3ad1b415-22fe-41b6-a394-d22f1f53dfd5";
const FORBIDDEN_ACCOUNT_NAME = "Spectra";
const DEFAULT_SEED = "acme-analytics-v1";

function safeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((numberValue(value) + Number.EPSILON) * factor) / factor;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeText(value))) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addYears(date, years) {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function businessDays(fromDate, toDate) {
  const rows = [];
  for (let cursor = new Date(fromDate.getTime()); cursor <= toDate; cursor = addDays(cursor, 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) rows.push(new Date(cursor.getTime()));
  }
  return rows;
}

function hashInt(seed, key) {
  return crypto.createHash("sha256").update(`${seed}::${key}`).digest().readUInt32BE(0);
}

function deterministicUuid(seed, key) {
  const bytes = crypto.createHash("sha256").update(`${seed}::${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseArgs(argv) {
  const options = { apply: false, seed: DEFAULT_SEED, asOf: isoDate(new Date()) };
  argv.forEach((arg) => {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg.startsWith("--seed=")) options.seed = safeText(arg.slice(7)) || DEFAULT_SEED;
    else if (arg.startsWith("--as-of=")) options.asOf = safeText(arg.slice(8));
    else if (arg.startsWith("--confirm-account-id=")) options.confirmAccountId = safeText(arg.slice(21));
    else throw new Error(`Unknown argument: ${arg}`);
  });
  if (!parseIsoDate(options.asOf)) throw new Error("--as-of must use YYYY-MM-DD format.");
  if (options.apply && options.confirmAccountId !== TARGET_ACCOUNT_ID) {
    throw new Error(`Apply requires --confirm-account-id=${TARGET_ACCOUNT_ID}`);
  }
  return options;
}

function assertTenantShape(tenant) {
  if (tenant.account?.id !== TARGET_ACCOUNT_ID || tenant.account?.name !== TARGET_ACCOUNT_NAME) {
    throw new Error("Safety stop: resolved account does not exactly match the locked ACME Inc. tenant.");
  }
  if (tenant.account?.name === FORBIDDEN_ACCOUNT_NAME) throw new Error("Safety stop: Spectra can never be targeted.");
  if (tenant.offices.length < 3 || tenant.departments.length < 3) {
    throw new Error("ACME Inc. must have at least three offices and three departments.");
  }
  if (tenant.projects.length < 9 || tenant.users.length < 9) {
    throw new Error("ACME Inc. must have at least nine projects and nine active users.");
  }
  const incompleteProject = tenant.projects.find(
    (project) => !project.clientId || !project.clientName || !project.officeId || !project.departmentId
  );
  if (incompleteProject) throw new Error(`Project ${incompleteProject.name || incompleteProject.id} has incomplete metadata.`);
  if (!tenant.internalCategories.length) throw new Error("ACME Inc. needs a corporate-function category.");
  if (!tenant.expenseCategories.length) throw new Error("ACME Inc. needs an expense category.");
}

async function loadTenant(sql) {
  const accounts = await sql`SELECT id::text AS id, name FROM accounts WHERE name = ${TARGET_ACCOUNT_NAME}`;
  if (accounts.length !== 1) throw new Error(`Expected one ${TARGET_ACCOUNT_NAME} account; found ${accounts.length}.`);
  const account = accounts[0];
  if (account.id !== TARGET_ACCOUNT_ID) throw new Error(`Safety stop: unexpected ACME Inc. account ID ${account.id}.`);
  const accountId = account.id;
  const [offices, departments, projects, users, internalCategories, expenseCategories] = await Promise.all([
    sql`SELECT id, name FROM office_locations WHERE account_id=${accountId}::uuid ORDER BY name`,
    sql`SELECT id, name FROM departments WHERE account_id=${accountId}::uuid ORDER BY name`,
    sql`
      SELECT p.id::text AS id, p.name, p.client_id::text AS "clientId", c.name AS "clientName",
        p.office_id AS "officeId", p.project_department_id AS "departmentId"
      FROM projects p JOIN clients c ON c.id=p.client_id AND c.account_id=p.account_id
      WHERE p.account_id=${accountId}::uuid ORDER BY LOWER(c.name), LOWER(p.name), p.id
    `,
    sql`
      SELECT id, display_name AS name, level, office_id AS "officeId", department_id AS "departmentId",
        base_rate AS "baseRate", cost_rate AS "costRate"
      FROM users WHERE account_id=${accountId}::uuid AND is_active=TRUE ORDER BY LOWER(display_name), id
    `,
    sql`
      SELECT id, name, COALESCE(group_name, '') AS "groupName"
      FROM corporate_function_categories WHERE account_id=${accountId}::uuid ORDER BY LOWER(name)
    `,
    sql`SELECT id, name FROM expense_categories WHERE account_uuid=${accountId}::uuid ORDER BY LOWER(name)`,
  ]);
  const tenant = { account, offices, departments, projects, users, internalCategories, expenseCategories };
  assertTenantShape(tenant);
  return tenant;
}

function scenarioTemplates(startDate, asOfDate) {
  const days = Math.max(1, Math.round((asOfDate - startDate) / 86400000));
  return [
    { key: "closed_overrun", label: "Closed fixed-fee overrun", status: "closed", pricing: "fixed_fee", realization: 0.72, closeFraction: 0.34, planFactor: 0.9 },
    { key: "open_healthy", label: "Open healthy forecast", status: "open", pricing: "fixed_fee", realization: 0.96, planFactor: 1.22 },
    { key: "open_tm_premium", label: "Open T&M premium", status: "open", pricing: "time_and_materials", realization: 1.12, planFactor: 1.18 },
    { key: "closed_healthy", label: "Closed near target", status: "closed", pricing: "fixed_fee", realization: 0.93, closeFraction: 0.64, planFactor: 1 },
    { key: "open_at_risk", label: "Open fixed-fee at risk", status: "open", pricing: "fixed_fee", realization: 0.76, planFactor: 1.35 },
    { key: "open_tm_discount", label: "Open discounted T&M", status: "open", pricing: "time_and_materials", realization: 0.86, planFactor: 1.3 },
    { key: "closed_premium", label: "Closed premium outcome", status: "closed", pricing: "fixed_fee", realization: 1.14, closeFraction: 0.91, planFactor: 1 },
    { key: "open_limited", label: "Open limited forecast", status: "open", pricing: "fixed_fee", realization: 0.88, planFactor: 1.28, limited: true },
    { key: "open_tm_strong", label: "Open strong T&M", status: "open", pricing: "time_and_materials", realization: 1.06, planFactor: 1.2 },
  ].map((scenario) => ({
    ...scenario,
    closeDate: scenario.status === "closed" ? isoDate(addDays(startDate, Math.round(days * scenario.closeFraction))) : "",
  }));
}

function projectSort(left, right) {
  return `${left.officeId}::${left.departmentId}::${left.clientName}::${left.name}`.localeCompare(
    `${right.officeId}::${right.departmentId}::${right.clientName}::${right.name}`
  );
}

function utilizationProfile(userIndex) {
  if (userIndex % 9 === 0) return { key: "underutilized", clientHours: 4.4, internalHours: 1, totalHours: 5.4 };
  if (userIndex % 11 === 0) return { key: "overutilized", clientHours: 8.7, internalHours: 0, totalHours: 8.7 };
  if (userIndex % 7 === 0) return { key: "high", clientHours: 7.5, internalHours: 0.5, totalHours: 8 };
  return { key: "healthy", clientHours: 6.6 + (userIndex % 3) * 0.2, internalHours: 1.4 - (userIndex % 3) * 0.2, totalHours: 8 };
}

function seasonalFactor(departmentName, date) {
  const month = date.getUTCMonth() + 1;
  const department = safeText(departmentName).toLowerCase();
  if (department.includes("tax") && month <= 4) return 1.12;
  if (department.includes("audit") && (month <= 3 || month >= 10)) return 1.08;
  if (department.includes("consult") && (month === 7 || month === 8)) return 0.9;
  return 1;
}

function entryStatus(date, asOfDate) {
  const ageDays = Math.floor((asOfDate - date) / 86400000);
  if (ageDays <= 4) return "pending";
  if (ageDays <= 10) return "submitted";
  return "approved";
}

function chooseInternalCategory(categories, userIndex, dayIndex, isPto) {
  if (isPto) return categories.find((row) => /time off|pto|sick/i.test(`${row.name} ${row.groupName}`)) || categories[0];
  const nonPto = categories.filter((row) => !/time off|pto|sick/i.test(`${row.name} ${row.groupName}`));
  const pool = nonPto.length ? nonPto : categories;
  return pool[(userIndex + dayIndex) % pool.length];
}

function buildScenarioData(tenant, options) {
  const asOfDate = parseIsoDate(options.asOf);
  const startDate = addDays(addYears(asOfDate, -1), 1);
  const days = businessDays(startDate, asOfDate);
  const templates = scenarioTemplates(startDate, asOfDate);
  const projects = [...tenant.projects].sort(projectSort).map((project, index) => ({ ...project, scenario: templates[index % 9] }));
  const departmentById = new Map(tenant.departments.map((row) => [row.id, row]));
  const approver = tenant.users.find((user) => numberValue(user.level, 99) <= 2) || tenant.users[0];
  const entries = [];
  const expenses = [];
  const projectHoursByUser = new Map();
  const projectActualStandard = new Map();
  const projectActualHours = new Map();
  const projectCoverage = new Set();
  const profileCounts = {};

  const addProjectHours = (project, user, hours) => {
    const pairKey = `${project.id}::${user.id}`;
    projectHoursByUser.set(pairKey, (projectHoursByUser.get(pairKey) || 0) + hours);
    projectActualStandard.set(project.id, (projectActualStandard.get(project.id) || 0) + hours * numberValue(user.baseRate));
    projectActualHours.set(project.id, (projectActualHours.get(project.id) || 0) + hours);
    projectCoverage.add(pairKey);
  };

  tenant.users.forEach((user, userIndex) => {
    const profile = utilizationProfile(userIndex);
    profileCounts[profile.key] = (profileCounts[profile.key] || 0) + 1;
    const ptoOffsets = new Set(Array.from({ length: 10 }, (_, index) => (userIndex * 7 + index * 23) % days.length));
    days.forEach((date, dayIndex) => {
      const dateIso = isoDate(date);
      const status = entryStatus(date, asOfDate);
      const approvedAt = status === "approved" ? `${dateIso}T20:00:00.000Z` : null;
      if (ptoOffsets.has(dayIndex)) {
        const category = chooseInternalCategory(tenant.internalCategories, userIndex, dayIndex, true);
        entries.push({ id: deterministicUuid(options.seed, `pto:${user.id}:${dateIso}`), user_id: user.id, user_name: user.name,
          entry_date: dateIso, client_name: "Internal", project_name: category.name, project_id: null,
          charge_center_id: category.id, task: category.name, hours: 8, notes: "", billable: false, status,
          approved_at: approvedAt, approved_by_user_id: status === "approved" ? approver.id : null,
          created_at: `${dateIso}T17:00:00.000Z`, updated_at: `${dateIso}T20:00:00.000Z` });
        return;
      }
      const departmentName = departmentById.get(user.departmentId)?.name || "";
      const isOvertimeDay = profile.key === "overutilized" && dayIndex % 20 === 0;
      const dailyCap = isOvertimeDay ? 13.5 : profile.totalHours;
      const clientHours = round(Math.min(dailyCap, isOvertimeDay ? 13.5 : profile.clientHours * seasonalFactor(departmentName, date)), 2);
      const eligible = projects.filter((project) => !project.scenario.closeDate || dateIso <= project.scenario.closeDate);
      if (!eligible.length) return;
      const primaryPool = eligible.filter((project) => project.officeId === user.officeId && project.departmentId === user.departmentId);
      const useGlobal = (dayIndex + userIndex) % 3 === 0 || !primaryPool.length;
      const project = useGlobal ? eligible[(dayIndex + userIndex * 5) % eligible.length] : primaryPool[(dayIndex + userIndex) % primaryPool.length];
      const projectDepartment = safeText(departmentById.get(project.departmentId)?.name).toLowerCase();
      const task = projectDepartment.includes("audit") ? "Fieldwork" : projectDepartment.includes("tax") ? "Tax preparation" : "Advisory delivery";
      entries.push({ id: deterministicUuid(options.seed, `client:${user.id}:${dateIso}:${project.id}`), user_id: user.id,
        user_name: user.name, entry_date: dateIso, client_name: project.clientName, project_name: project.name,
        project_id: Number(project.id), charge_center_id: null, task, hours: clientHours, notes: "", billable: true,
        status, approved_at: approvedAt, approved_by_user_id: status === "approved" ? approver.id : null,
        created_at: `${dateIso}T17:00:00.000Z`, updated_at: `${dateIso}T20:00:00.000Z` });
      addProjectHours(project, user, clientHours);
      const internalHours = date.getUTCDay() === 5
        ? round(Math.max(0, profile.internalHours * 5 - Math.max(0, clientHours - profile.clientHours)), 2)
        : 0;
      if (internalHours > 0) {
        const category = chooseInternalCategory(tenant.internalCategories, userIndex, date.getUTCMonth(), false);
        entries.push({ id: deterministicUuid(options.seed, `internal:${user.id}:${dateIso}:${category.id}`), user_id: user.id,
          user_name: user.name, entry_date: dateIso, client_name: "Internal", project_name: category.name,
          project_id: null, charge_center_id: category.id, task: category.name, hours: internalHours, notes: "",
          billable: false, status, approved_at: approvedAt, approved_by_user_id: status === "approved" ? approver.id : null,
          created_at: `${dateIso}T17:10:00.000Z`, updated_at: `${dateIso}T20:00:00.000Z` });
      }
    });
  });

  tenant.users.forEach((user, userIndex) => projects.forEach((project, projectIndex) => {
    const pairKey = `${project.id}::${user.id}`;
    if (projectCoverage.has(pairKey)) return;
    const eligibleDays = days.filter((date) => !project.scenario.closeDate || isoDate(date) <= project.scenario.closeDate);
    const dateIso = isoDate(eligibleDays[(userIndex * 3 + projectIndex) % eligibleDays.length]);
    entries.push({ id: deterministicUuid(options.seed, `coverage:${user.id}:${project.id}:${dateIso}`), user_id: user.id,
      user_name: user.name, entry_date: dateIso, client_name: project.clientName, project_name: project.name,
      project_id: Number(project.id), charge_center_id: null, task: "Cross-project support", hours: 1, notes: "",
      billable: true, status: "approved", approved_at: `${dateIso}T20:00:00.000Z`, approved_by_user_id: approver.id,
      created_at: `${dateIso}T17:30:00.000Z`, updated_at: `${dateIso}T20:00:00.000Z` });
    addProjectHours(project, user, 1);
  }));

  const projectMembers = [];
  const budgets = [];
  const projectUpdates = [];
  projects.forEach((project, projectIndex) => {
    const scenario = project.scenario;
    let plannedStandard = 0;
    let plannedHours = 0;
    tenant.users.forEach((user) => {
      const actualHours = projectHoursByUser.get(`${project.id}::${user.id}`) || 0;
      const budgetHours = round(Math.max(1, actualHours * scenario.planFactor), 2);
      const chargeRate = round(numberValue(user.baseRate) * scenario.realization, 2);
      projectMembers.push({ project_id: Number(project.id), user_id: user.id, charge_rate_override: chargeRate });
      plannedHours += budgetHours;
      plannedStandard += budgetHours * numberValue(user.baseRate);
      if (!scenario.limited) budgets.push({ project_id: Number(project.id), user_id: user.id, budget_hours: budgetHours,
        budget_amount: round(budgetHours * numberValue(user.baseRate), 2), rate_override: chargeRate });
    });
    const actualStandard = projectActualStandard.get(project.id) || 0;
    const actualHours = projectActualHours.get(project.id) || 0;
    const economicBase = scenario.status === "closed" ? actualStandard : plannedStandard;
    const contractAmount = scenario.pricing === "fixed_fee" ? round(economicBase * scenario.realization, 2) : null;
    const percentComplete = scenario.status === "closed" ? 100 : round(Math.min(92, plannedHours > 0 ? actualHours / plannedHours * 100 : 0), 2);
    projectUpdates.push({ id: Number(project.id), is_active: scenario.status === "open", budget_amount: round(plannedStandard, 2),
      contract_amount: contractAmount, pricing_model: scenario.pricing, target_realization_pct: projectIndex % 3 === 0 ? 90 : 95,
      percent_complete: percentComplete, planning_status: scenario.limited ? "draft" : "approved",
      scenario_key: scenario.key, scenario_label: scenario.label, close_date: scenario.closeDate });
  });

  const monthKeys = Array.from(new Set(days.map((date) => isoDate(date).slice(0, 7))));
  projects.forEach((project, projectIndex) => monthKeys.forEach((monthKey, monthIndex) => {
    const dateIso = `${monthKey}-${String(8 + (projectIndex + monthIndex) % 15).padStart(2, "0")}`;
    if (dateIso < isoDate(startDate) || dateIso > options.asOf || (project.scenario.closeDate && dateIso > project.scenario.closeDate)) return;
    const user = tenant.users[(projectIndex * 3 + monthIndex) % tenant.users.length];
    const category = tenant.expenseCategories[(projectIndex + monthIndex) % tenant.expenseCategories.length];
    const status = entryStatus(parseIsoDate(dateIso), asOfDate);
    const amount = round(75 + hashInt(options.seed, `expense:${project.id}:${monthKey}`) % 850 + projectIndex * 35, 2);
    expenses.push({ id: `synthetic-acme-${crypto.createHash("sha1").update(`${options.seed}:${project.id}:${monthKey}`).digest("hex").slice(0, 24)}`,
      user_id: user.id, client_name: project.clientName, project_name: project.name, expense_date: dateIso,
      category: category.name, amount, is_billable: (projectIndex + monthIndex) % 4 === 0 ? 0 : 1, notes: "", status,
      approved_at: status === "approved" ? `${dateIso}T20:00:00.000Z` : null, created_at: `${dateIso}T18:00:00.000Z`,
      updated_at: `${dateIso}T20:00:00.000Z`, created_by: user.id });
  }));

  const missingCoverage = [];
  tenant.users.forEach((user) => projects.forEach((project) => {
    if (!projectCoverage.has(`${project.id}::${user.id}`)) missingCoverage.push(`${user.name} / ${project.name}`);
  }));
  if (missingCoverage.length) throw new Error(`Coverage failed for ${missingCoverage.length} member/project pairs.`);
  const dailyTotals = new Map();
  entries.forEach((entry) => {
    const key = `${entry.user_id}::${entry.entry_date}`;
    dailyTotals.set(key, round((dailyTotals.get(key) || 0) + numberValue(entry.hours), 2));
  });
  const excessiveDay = Array.from(dailyTotals.entries()).find(([, hours]) => hours > 14);
  if (excessiveDay) throw new Error(`Generated daily total exceeds 14 hours for ${excessiveDay[0]}: ${excessiveDay[1]}.`);
  return { accountId: tenant.account.id, accountName: tenant.account.name, seed: options.seed, fromDate: isoDate(startDate),
    toDate: options.asOf, entries, expenses, projectMembers, budgets, projectUpdates, profileCounts,
    scenarios: projects.map((project) => ({ projectId: project.id, client: project.clientName, project: project.name,
      scenario: project.scenario.label, status: project.scenario.status, closeDate: project.scenario.closeDate || null })) };
}

function chunks(rows, size = 750) {
  const result = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

async function applyScenario(sql, data) {
  if (data.accountId !== TARGET_ACCOUNT_ID || data.accountName !== TARGET_ACCOUNT_NAME) throw new Error("Safety stop: invalid target.");
  const accountId = data.accountId;
  const queries = [
    sql`DELETE FROM entries WHERE account_id=${accountId}::uuid`,
    sql`DELETE FROM expenses WHERE account_id=${accountId}::uuid`,
    sql`DELETE FROM project_member_budgets WHERE account_id=${accountId}::uuid`,
    sql`DELETE FROM project_members WHERE account_id=${accountId}::uuid`,
    sql`
      UPDATE projects p SET is_active=x.is_active, budget_amount=x.budget_amount, contract_amount=x.contract_amount,
        pricing_model=x.pricing_model, target_realization_pct=x.target_realization_pct, percent_complete=x.percent_complete,
        percent_complete_updated_at=NOW(), planning_status=x.planning_status, updated_at=NOW()
      FROM jsonb_to_recordset(${JSON.stringify(data.projectUpdates)}::jsonb) AS x(id bigint, is_active boolean,
        budget_amount numeric, contract_amount numeric, pricing_model text, target_realization_pct numeric,
        percent_complete numeric, planning_status text)
      WHERE p.account_id=${accountId}::uuid AND p.id=x.id
    `,
    sql`
      INSERT INTO project_members (project_id,user_id,account_id,assigned_by,charge_rate_override,created_at)
      SELECT x.project_id,x.user_id,${accountId}::uuid,NULL,x.charge_rate_override,NOW()
      FROM jsonb_to_recordset(${JSON.stringify(data.projectMembers)}::jsonb)
        AS x(project_id bigint,user_id text,charge_rate_override numeric)
    `,
    sql`
      INSERT INTO project_member_budgets (account_id,project_id,user_id,budget_hours,budget_amount,rate_override,created_at,updated_at)
      SELECT ${accountId}::uuid,x.project_id,x.user_id,x.budget_hours,x.budget_amount,x.rate_override,NOW(),NOW()
      FROM jsonb_to_recordset(${JSON.stringify(data.budgets)}::jsonb)
        AS x(project_id bigint,user_id text,budget_hours numeric,budget_amount numeric,rate_override numeric)
    `,
  ];
  chunks(data.entries).forEach((batch) => queries.push(sql`
    INSERT INTO entries (id,user_id,user_name,entry_date,client_name,project_name,project_id,charge_center_id,task,hours,
      notes,billable,status,approved_at,approved_by_user_id,account_id,created_at,updated_at)
    SELECT x.id,x.user_id,x.user_name,x.entry_date,x.client_name,x.project_name,x.project_id,x.charge_center_id,x.task,x.hours,
      x.notes,x.billable,x.status,x.approved_at,x.approved_by_user_id,${accountId}::uuid,x.created_at,x.updated_at
    FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(id uuid,user_id text,user_name text,entry_date date,
      client_name text,project_name text,project_id bigint,charge_center_id text,task text,hours numeric,notes text,
      billable boolean,status text,approved_at timestamptz,approved_by_user_id text,created_at timestamptz,updated_at timestamptz)
  `));
  chunks(data.expenses).forEach((batch) => queries.push(sql`
    INSERT INTO expenses (id,account_id,user_id,client_name,project_name,expense_date,category,amount,is_billable,notes,status,
      approved_at,created_at,updated_at,created_by)
    SELECT x.id,${accountId}::uuid,x.user_id,x.client_name,x.project_name,x.expense_date,x.category,x.amount,x.is_billable,
      x.notes,x.status,x.approved_at,x.created_at,x.updated_at,x.created_by
    FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(id text,user_id text,client_name text,project_name text,
      expense_date text,category text,amount numeric,is_billable integer,notes text,status text,approved_at text,
      created_at text,updated_at text,created_by text)
  `));
  await sql.transaction(queries);
}

async function getForbiddenCounts(sql) {
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM entries e JOIN accounts a ON a.id=e.account_id WHERE a.name=${FORBIDDEN_ACCOUNT_NAME}) AS entries,
      (SELECT COUNT(*) FROM expenses e JOIN accounts a ON a.id=e.account_id WHERE a.name=${FORBIDDEN_ACCOUNT_NAME}) AS expenses
  `;
  return { entries: Number(rows[0]?.entries || 0), expenses: Number(rows[0]?.expenses || 0) };
}

async function verifyScenario(sql, data, forbiddenCountsBefore) {
  const accountId = data.accountId;
  const [counts, coverage, statuses, spectraCounts] = await Promise.all([
    sql`SELECT (SELECT COUNT(*) FROM entries WHERE account_id=${accountId}::uuid) AS entries,
      (SELECT COUNT(*) FROM expenses WHERE account_id=${accountId}::uuid) AS expenses,
      (SELECT COUNT(*) FROM project_members WHERE account_id=${accountId}::uuid) AS "projectMembers",
      (SELECT COUNT(*) FROM project_member_budgets WHERE account_id=${accountId}::uuid) AS budgets`,
    sql`SELECT COUNT(*) AS pairs FROM (SELECT DISTINCT user_id,project_id FROM entries
      WHERE account_id=${accountId}::uuid AND project_id IS NOT NULL AND deleted_at IS NULL) pairs`,
    sql`SELECT is_active AS "isActive",pricing_model AS "pricingModel",COUNT(*) AS count FROM projects
      WHERE account_id=${accountId}::uuid GROUP BY is_active,pricing_model ORDER BY is_active,pricing_model`,
    getForbiddenCounts(sql),
  ]);
  const result = { counts: counts[0], coveredMemberProjectPairs: Number(coverage[0]?.pairs || 0), projectMix: statuses,
    spectraCounts };
  if (Number(result.counts.entries) !== data.entries.length || Number(result.counts.expenses) !== data.expenses.length) {
    throw new Error("Post-apply verification failed: persisted row counts differ.");
  }
  if (result.coveredMemberProjectPairs !== data.projectMembers.length) throw new Error("Post-apply coverage verification failed.");
  if (
    spectraCounts.entries !== forbiddenCountsBefore.entries ||
    spectraCounts.expenses !== forbiddenCountsBefore.expenses
  ) {
    throw new Error("Safety verification failed: Spectra time or expense counts changed.");
  }
  return result;
}

function printSummary(data, mode, verification = null) {
  process.stdout.write(`${JSON.stringify({ mode, account: `${data.accountName} (${data.accountId})`,
    period: `${data.fromDate} through ${data.toDate}`, seed: data.seed,
    generated: { timeEntries: data.entries.length, expenses: data.expenses.length,
      memberProjectAssignments: data.projectMembers.length, projectPlans: data.budgets.length },
    utilizationProfiles: data.profileCounts, projects: data.scenarios, verification }, null, 2)}\n`);
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const sql = await getSql();
  const tenant = await loadTenant(sql);
  const data = buildScenarioData(tenant, options);
  if (!options.apply) return printSummary(data, "dry-run");
  const forbiddenCountsBefore = await getForbiddenCounts(sql);
  await applyScenario(sql, data);
  printSummary(data, "applied", await verifyScenario(sql, data, forbiddenCountsBefore));
}

if (require.main === module) run().catch((error) => {
  console.error(`ACME analytics seed failed: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { TARGET_ACCOUNT_ID, TARGET_ACCOUNT_NAME, buildScenarioData, deterministicUuid, parseArgs };
