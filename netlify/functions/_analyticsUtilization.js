"use strict";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const normalized = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(normalized) ? normalized.slice(0, 10) : "";
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monday(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return addDays(isoDate, day === 0 ? -6 : 1 - day);
}

function businessDays(from, to) {
  if (!from || !to || from > to) return 0;
  let count = 0;
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const day = new Date(`${cursor}T00:00:00.000Z`).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function overlap(from, to, user, capTo) {
  let start = from;
  let end = capTo && capTo < to ? capTo : to;
  const activeFrom = isoDate(user?.activeFrom || user?.active_from);
  const activeTo = isoDate(user?.activeTo || user?.active_to);
  if (activeFrom && activeFrom > start) start = activeFrom;
  if (activeFrom && activeTo && activeTo >= activeFrom && activeTo < end) end = activeTo;
  return start <= end ? { from: start, to: end } : null;
}

function capacityHours(from, to, users, capTo) {
  return users.reduce((sum, user) => {
    const range = overlap(from, to, user, capTo);
    return sum + (range ? businessDays(range.from, range.to) * 8 : 0);
  }, 0);
}

function labelDate(isoDate, options) {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

function buildBuckets(period, from, to) {
  const buckets = [];
  if (period === "this_week" || period === "last_week") {
    const start = monday(from);
    for (let index = 0; index < 7; index += 1) {
      const date = addDays(start, index);
      buckets.push({ key: `d${index}::${date}`, label: labelDate(date, { weekday: "short", month: "numeric", day: "numeric" }), from: date, to: date });
    }
    return buckets;
  }
  if (period === "this_month" || period === "last_month") {
    let start = monday(from);
    let index = 0;
    while (start <= to) {
      const end = addDays(start, 6);
      buckets.push({ key: `w${index}::${start}`, label: `${labelDate(start, { month: "short", day: "numeric" })} - ${labelDate(end, { month: "short", day: "numeric" })}`, from: start, to: end });
      start = addDays(start, 7);
      index += 1;
    }
    return buckets;
  }
  let cursor = `${from.slice(0, 7)}-01`;
  while (cursor <= to) {
    const date = new Date(`${cursor}T00:00:00.000Z`);
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const end = addDays(next, -1);
    buckets.push({ key: `m::${cursor}`, label: labelDate(cursor, { month: "short", year: "numeric" }), from: cursor < from ? from : cursor, to: end > to ? to : end });
    cursor = next;
  }
  return buckets;
}

function memberTitle(user, levelLabels) {
  const explicit = text(user?.profileTitle || user?.member_profile_title || user?.title || user?.jobTitle);
  if (explicit) return explicit;
  const level = Number(user?.level);
  return text(levelLabels?.[level]?.label) || "Unassigned";
}

function groupIdentity(groupBy, user, lookups, levelLabels) {
  if (groupBy === "office") {
    const name = lookups.offices.get(text(user.officeId || user.office_id)) || "Unassigned";
    return { key: `office::${name.toLowerCase()}`, name };
  }
  if (groupBy === "department") {
    const name = lookups.departments.get(text(user.departmentId || user.department_id)) || "Unassigned";
    return { key: `department::${name.toLowerCase()}`, name };
  }
  if (groupBy === "title") {
    const name = memberTitle(user, levelLabels);
    return { key: `title::${name.toLowerCase()}`, name };
  }
  const id = text(user.id);
  const name = text(user.displayName || user.display_name || user.username) || "Unassigned";
  return { key: `member::${id || name.toLowerCase()}`, name };
}

async function buildUtilizationResult(sql, details) {
  const { accountId, filters, shell } = details;
  const allowedIds = (shell.utilizationUsers || []).map((user) => text(user?.id)).filter(Boolean);
  const safeIds = allowedIds.length ? allowedIds : ["__none__"];
  const officeId = text(filters.officeId);
  const departmentId = text(filters.departmentId);
  const rows = await sql`
    SELECT TO_CHAR(e.entry_date, 'YYYY-MM-DD') AS date, u.id AS "userId",
      SUM(CASE WHEN (e.charge_center_id IS NOT NULL OR (e.project_id IS NULL AND LOWER(e.client_name) IN ('internal', 'internal work')))
        AND CONCAT_WS(' ', e.task, e.project_name, e.notes, cfc.name, cfg.name)
        ~* '(^|[^a-z])(pto|vacation|holiday|sick|leave|bereavement|personal day|parental|jury)([^a-z]|$)'
        THEN e.hours ELSE 0 END)::FLOAT8 AS "ptoHours",
      SUM(CASE WHEN NOT ((e.charge_center_id IS NOT NULL OR (e.project_id IS NULL AND LOWER(e.client_name) IN ('internal', 'internal work')))
        AND CONCAT_WS(' ', e.task, e.project_name, e.notes, cfc.name, cfg.name)
        ~* '(^|[^a-z])(pto|vacation|holiday|sick|leave|bereavement|personal day|parental|jury)([^a-z]|$)')
        AND (e.charge_center_id IS NOT NULL OR e.billable = FALSE OR LOWER(e.client_name) IN ('internal', 'internal work'))
        THEN e.hours ELSE 0 END)::FLOAT8 AS "internalHours",
      SUM(CASE WHEN e.charge_center_id IS NULL AND e.billable = TRUE
        AND LOWER(e.client_name) NOT IN ('internal', 'internal work') THEN e.hours ELSE 0 END)::FLOAT8 AS "clientHours"
    FROM entries e
    JOIN users u ON (u.id = e.user_id OR LOWER(u.display_name) = LOWER(e.user_name)) AND u.account_id = e.account_id
    LEFT JOIN corporate_function_categories cfc ON cfc.id = e.charge_center_id AND cfc.account_id = e.account_id
    LEFT JOIN corporate_function_groups cfg ON cfg.id = cfc.group_id AND cfg.account_id = e.account_id
    WHERE e.account_id = ${accountId}::uuid AND e.deleted_at IS NULL
      AND e.entry_date BETWEEN ${filters.from}::date AND ${filters.to}::date
      AND u.id = ANY(${safeIds})
      AND (${officeId} = '' OR u.office_id = ${officeId})
      AND (${departmentId} = '' OR u.department_id = ${departmentId})
    GROUP BY e.entry_date, u.id
    ORDER BY e.entry_date, u.id
  `;

  const users = (shell.utilizationUsers || []).filter((user) =>
    (!officeId || text(user.officeId || user.office_id) === officeId) &&
    (!departmentId || text(user.departmentId || user.department_id) === departmentId)
  );
  const usersById = new Map(users.map((user) => [text(user.id), user]));
  const lookups = {
    offices: new Map((shell.officeLocations || []).map((item) => [text(item.id), text(item.name)])),
    departments: new Map((shell.departments || []).map((item) => [text(item.id), text(item.name)])),
  };
  const buckets = buildBuckets(filters.period, filters.from, filters.to);
  const groups = new Map();
  const totals = { clientHours: 0, internalHours: 0, ptoHours: 0 };
  for (const row of rows) {
    const user = usersById.get(text(row.userId));
    if (!user) continue;
    const identity = groupIdentity(filters.groupBy, user, lookups, shell.levelLabels || {});
    if (!groups.has(identity.key)) groups.set(identity.key, { ...identity, users: new Map(), clientHours: 0, internalHours: 0, ptoHours: 0, buckets: new Map() });
    const group = groups.get(identity.key);
    group.users.set(text(user.id), user);
    for (const metric of ["clientHours", "internalHours", "ptoHours"]) {
      const value = number(row[metric]);
      group[metric] += value;
      totals[metric] += value;
    }
    const bucket = buckets.find((item) => row.date >= item.from && row.date <= item.to);
    if (bucket) {
      const sample = group.buckets.get(bucket.key) || { clientHours: 0, internalHours: 0, ptoHours: 0 };
      sample.clientHours += number(row.clientHours);
      sample.internalHours += number(row.internalHours);
      sample.ptoHours += number(row.ptoHours);
      group.buckets.set(bucket.key, sample);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const timeSeriesByKey = {};
  const resultRows = Array.from(groups.values()).map((group) => {
    const groupUsers = Array.from(group.users.values());
    const capacity = capacityHours(filters.from, filters.to, groupUsers);
    timeSeriesByKey[group.key] = buckets.map((bucket) => {
      const sample = group.buckets.get(bucket.key) || { clientHours: 0, internalHours: 0, ptoHours: 0 };
      const bucketCapacity = capacityHours(bucket.from < filters.from ? filters.from : bucket.from, bucket.to > filters.to ? filters.to : bucket.to, groupUsers, today);
      const idleHours = Math.max(0, bucketCapacity - sample.clientHours - sample.internalHours - sample.ptoHours);
      return { key: bucket.key, label: bucket.label, ...sample, idleHours, capacityHours: bucketCapacity, utilizationPct: bucketCapacity > 0 ? (sample.clientHours / bucketCapacity) * 100 : null };
    });
    const idleHours = Math.max(0, capacity - group.clientHours - group.internalHours - group.ptoHours);
    const firstUser = groupUsers[0] || {};
    return {
      key: group.key,
      name: group.name,
      memberId: filters.groupBy === "member" ? text(firstUser.id) : "",
      memberTitle: filters.groupBy === "member" ? memberTitle(firstUser, shell.levelLabels || {}) : "",
      utilizationPct: capacity > 0 ? (group.clientHours / capacity) * 100 : null,
      clientHours: group.clientHours,
      internalHours: group.internalHours,
      ptoHours: group.ptoHours,
      idleHours,
      capacityHours: capacity,
      memberCount: groupUsers.length,
    };
  }).filter((row) => filters.groupBy !== "member" || row.capacityHours > 0);
  resultRows.sort((a, b) => (b.utilizationPct ?? -1) - (a.utilizationPct ?? -1) || b.clientHours - a.clientHours || a.name.localeCompare(b.name));
  const totalCapacity = capacityHours(filters.from, filters.to, users);
  return {
    kpis: {
      avgUtilizationPct: totalCapacity > 0 ? (totals.clientHours / totalCapacity) * 100 : null,
      ...totals,
      idleHours: Math.max(0, totalCapacity - totals.clientHours - totals.internalHours - totals.ptoHours),
    },
    rows: resultRows,
    timeBuckets: buckets.map(({ key, label }) => ({ key, label })),
    timeSeriesByKey,
    visibilityScope: shell.utilizationScope,
  };
}

module.exports = { buildBuckets, buildUtilizationResult, businessDays, capacityHours };
