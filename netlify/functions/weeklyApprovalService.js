"use strict";

const crypto = require("crypto");
const { buildApprovalPackages, deriveSubmissionStatus, weekBounds } = require("./weeklyApprovalDomain");
const { createSystemInboxItems } = require("./_inbox");
const { logAudit } = require("./_db");

function id() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function text(value) {
  return String(value ?? "").trim();
}

function roleKey(user) {
  return text(user?.permissionGroup || user?.permission_group || user?.role).toLowerCase();
}

function isAdministrative(user) {
  return ["superuser", "global_admin"].includes(roleKey(user));
}

async function ensureWeeklyApprovalSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_submissions (
      id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start DATE NOT NULL, week_end DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', member_note TEXT,
      submitted_at TIMESTAMPTZ, submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ, locked_at TIMESTAMPTZ, reopened_at TIMESTAMPTZ,
      reopened_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, reopen_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, member_user_id, week_start)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_approval_packages (
      id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      submission_id UUID NOT NULL REFERENCES weekly_submissions(id) ON DELETE CASCADE,
      package_key TEXT NOT NULL, package_type TEXT NOT NULL,
      project_id BIGINT REFERENCES projects(id) ON DELETE RESTRICT,
      reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'submitted', request_note TEXT,
      reviewed_at TIMESTAMPTZ, reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (submission_id, package_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_approval_items (
      id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      submission_id UUID NOT NULL REFERENCES weekly_submissions(id) ON DELETE CASCADE,
      package_id UUID NOT NULL REFERENCES weekly_approval_packages(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL, record_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (submission_id, record_type, record_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS weekly_submissions_member_week_idx ON weekly_submissions(account_id, member_user_id, week_start DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS weekly_packages_reviewer_status_idx ON weekly_approval_packages(account_id, reviewer_user_id, status, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS weekly_items_record_idx ON weekly_approval_items(account_id, record_type, record_id)`;
}

async function loadWeekRecords(sql, { accountId, memberUserId, weekStart, weekEnd }) {
  const [timeRows, expenseRows] = await Promise.all([
    sql`
      SELECT e.id::text AS id, 'time' AS "recordType", COALESCE(e.project_id, p.id)::text AS "projectId",
             e.hours::FLOAT8 AS hours, 0::FLOAT8 AS amount
      FROM entries e
      LEFT JOIN clients c ON c.account_id = e.account_id AND LOWER(c.name) = LOWER(e.client_name)
      LEFT JOIN projects p ON p.account_id = e.account_id AND p.client_id = c.id AND LOWER(p.name) = LOWER(e.project_name)
      WHERE e.account_id = ${accountId}::uuid AND e.user_id = ${memberUserId}
        AND e.entry_date BETWEEN ${weekStart}::date AND ${weekEnd}::date AND e.deleted_at IS NULL
    `,
    sql`
      SELECT x.id::text AS id, 'expense' AS "recordType", p.id::text AS "projectId",
             0::FLOAT8 AS hours, x.amount::FLOAT8 AS amount
      FROM expenses x
      LEFT JOIN clients c ON c.account_id = x.account_id AND LOWER(c.name) = LOWER(x.client_name)
      LEFT JOIN projects p ON p.account_id = x.account_id AND p.client_id = c.id AND LOWER(p.name) = LOWER(x.project_name)
      WHERE x.account_id = ${accountId}::uuid AND x.user_id = ${memberUserId}
        AND x.expense_date::date BETWEEN ${weekStart}::date AND ${weekEnd}::date AND x.deleted_at IS NULL
    `,
  ]);
  return [...timeRows, ...expenseRows];
}

async function assertRecordEditable(sql, { accountId, memberUserId, recordType, recordId, recordDate, projectId }) {
  await ensureWeeklyApprovalSchema(sql);
  const normalizedRecordId = text(recordId);
  if (normalizedRecordId) {
    const linkedRows = await sql`
      SELECT wp.status, wp.package_type AS "packageType", wp.project_id AS "projectId"
      FROM weekly_approval_items wi
      JOIN weekly_approval_packages wp ON wp.id = wi.package_id AND wp.account_id = wi.account_id
      WHERE wi.account_id = ${accountId}::uuid AND wi.record_type = ${recordType} AND wi.record_id = ${normalizedRecordId}
      ORDER BY wi.created_at DESC LIMIT 1
    `;
    if (linkedRows[0] && linkedRows[0].status !== "changes_requested") {
      throw Object.assign(new Error("This record belongs to a submitted weekly package and cannot be changed."), { statusCode: 409 });
    }
    if (linkedRows[0]) {
      const originalProjectId = text(linkedRows[0].projectId);
      if (originalProjectId !== text(projectId)) {
        throw Object.assign(new Error("A change-requested record cannot be moved to a different approval package."), { statusCode: 409 });
      }
      return;
    }
  }
  const bounds = weekBounds(recordDate);
  const submissions = await sql`
    SELECT id, status FROM weekly_submissions
    WHERE account_id = ${accountId}::uuid AND member_user_id = ${memberUserId}
      AND week_start = ${bounds.weekStart}::date LIMIT 1
  `;
  const submission = submissions[0];
  if (!submission || submission.status === "open") return;
  if (submission.status === "changes_requested") {
    const normalizedProjectId = text(projectId);
    const packages = await sql`
      SELECT status FROM weekly_approval_packages
      WHERE account_id = ${accountId}::uuid AND submission_id = ${submission.id}
        AND (
          (${normalizedProjectId || null}::text IS NOT NULL AND project_id::text = ${normalizedProjectId || null})
          OR (${normalizedProjectId || null}::text IS NULL AND package_type = 'non_project')
        )
      LIMIT 1
    `;
    if (packages[0]?.status === "changes_requested") return;
  }
  throw Object.assign(new Error("This week has been submitted and must be reopened before records can be changed."), { statusCode: 409 });
}

async function assertStandaloneApprovalAllowed(sql, { accountId, recordType, recordId }) {
  await ensureWeeklyApprovalSchema(sql);
  const linkedRows = await sql`
    SELECT wp.id FROM weekly_approval_items wi
    JOIN weekly_approval_packages wp ON wp.id = wi.package_id AND wp.account_id = wi.account_id
    WHERE wi.account_id = ${accountId}::uuid AND wi.record_type = ${recordType} AND wi.record_id = ${text(recordId)}
    LIMIT 1
  `;
  if (linkedRows[0]) {
    throw Object.assign(new Error("Review this record through its weekly approval package."), { statusCode: 409 });
  }
}

async function submitWeek(sql, { accountId, currentUser, payload }) {
  await ensureWeeklyApprovalSchema(sql);
  const memberUserId = text(payload?.memberUserId || currentUser?.id);
  if (!memberUserId || (memberUserId !== text(currentUser?.id) && !isAdministrative(currentUser))) {
    throw Object.assign(new Error("You can only submit your own week."), { statusCode: 403 });
  }
  const { weekStart, weekEnd } = weekBounds(payload?.weekStart || new Date());
  const members = await sql`
    SELECT id, display_name AS "displayName", office_id AS "officeId", department_id AS "departmentId"
    FROM users WHERE account_id = ${accountId}::uuid AND id = ${memberUserId} AND is_active = TRUE LIMIT 1
  `;
  const member = members[0];
  if (!member) throw Object.assign(new Error("Member not found."), { statusCode: 404 });
  const existingRows = await sql`
    SELECT id, status FROM weekly_submissions
    WHERE account_id = ${accountId}::uuid AND member_user_id = ${memberUserId} AND week_start = ${weekStart}::date LIMIT 1
  `;
  if (["approved", "locked"].includes(text(existingRows[0]?.status))) {
    throw Object.assign(new Error("This week is approved and must be reopened before it can be resubmitted."), { statusCode: 409 });
  }
  const records = await loadWeekRecords(sql, { accountId, memberUserId, weekStart, weekEnd });
  if (!records.length) throw Object.assign(new Error("Enter time or expenses before submitting this week."), { statusCode: 400 });
  const projectIds = [...new Set(records.map((record) => text(record.projectId)).filter(Boolean))];
  const [projects, departmentLeadAssignments, officeLocations] = await Promise.all([
    sql`SELECT id, name, project_lead_id AS "projectLeadId", project_executive_id AS "projectExecutiveId" FROM projects WHERE account_id = ${accountId}::uuid AND id = ANY(${projectIds.length ? projectIds.map(Number) : [0]}::bigint[])`,
    sql`SELECT office_id AS "officeId", department_id AS "departmentId", user_id AS "userId" FROM department_lead_assignments WHERE account_id = ${accountId}::uuid`,
    sql`SELECT id, office_lead_user_id AS "officeLeadUserId" FROM office_locations WHERE account_id = ${accountId}::uuid`,
  ]);
  const packages = buildApprovalPackages({ records, projects, member, departmentLeadAssignments, officeLocations });
  if (packages.some((item) => item.reviewerUserId === memberUserId)) {
    throw Object.assign(new Error("A member cannot approve their own weekly submission. Assign another lead."), { statusCode: 400 });
  }
  const submissionId = text(existingRows[0]?.id) || id();
  const existingPackages = existingRows[0] ? await sql`
    SELECT id, package_key AS "packageKey", status
    FROM weekly_approval_packages WHERE account_id = ${accountId}::uuid AND submission_id = ${submissionId}
  ` : [];
  const existingPackageByKey = new Map(existingPackages.map((item) => [item.packageKey, item]));
  const packagesToCreate = packages.filter((item) => {
    const existingPackage = existingPackageByKey.get(item.packageKey);
    return !existingPackage || existingPackage.status === "changes_requested";
  });
  const retainedStatuses = existingPackages
    .filter((item) => item.status !== "changes_requested")
    .map((item) => item.status);
  const submissionStatus = deriveSubmissionStatus([...retainedStatuses, ...packagesToCreate.map(() => "submitted")]);
  const queries = [
    sql`
      INSERT INTO weekly_submissions (id, account_id, member_user_id, week_start, week_end, status, member_note, submitted_at, submitted_by_user_id)
      VALUES (${submissionId}, ${accountId}::uuid, ${memberUserId}, ${weekStart}::date, ${weekEnd}::date, ${submissionStatus}, ${text(payload?.note) || null}, NOW(), ${text(currentUser?.id)})
      ON CONFLICT (account_id, member_user_id, week_start) DO UPDATE SET
        week_end = EXCLUDED.week_end, status = EXCLUDED.status, member_note = EXCLUDED.member_note,
        submitted_at = NOW(), submitted_by_user_id = EXCLUDED.submitted_by_user_id,
        approved_at = NULL, locked_at = NULL, updated_at = NOW()
    `,
  ];
  for (const existingPackage of existingPackages.filter((item) => item.status === "changes_requested")) {
    queries.push(sql`DELETE FROM weekly_approval_items WHERE account_id = ${accountId}::uuid AND package_id = ${existingPackage.id}`);
    queries.push(sql`DELETE FROM weekly_approval_packages WHERE account_id = ${accountId}::uuid AND id = ${existingPackage.id}`);
  }
  for (const approvalPackage of packagesToCreate) {
    const packageId = id();
    queries.push(sql`
      INSERT INTO weekly_approval_packages (id, account_id, submission_id, package_key, package_type, project_id, reviewer_user_id, status)
      VALUES (${packageId}, ${accountId}::uuid, ${submissionId}, ${approvalPackage.packageKey}, ${approvalPackage.packageType}, ${approvalPackage.projectId ? Number(approvalPackage.projectId) : null}, ${approvalPackage.reviewerUserId}, 'submitted')
    `);
    for (const item of approvalPackage.items) {
      queries.push(sql`
        INSERT INTO weekly_approval_items (id, account_id, submission_id, package_id, record_type, record_id)
        VALUES (${id()}, ${accountId}::uuid, ${submissionId}, ${packageId}, ${item.recordType}, ${item.recordId})
      `);
    }
  }
  await sql.transaction(queries);
  await logAudit(sql, {
    accountId, entityType: "weekly_submission", entityId: submissionId, action: "submit",
    changedByUserId: currentUser.id, changedByNameSnapshot: currentUser.displayName,
    targetUserId: memberUserId, beforeJson: existingRows[0] || null,
    afterJson: { status: submissionStatus, weekStart, weekEnd, packageCount: packages.length },
    changedFieldsJson: ["status", "submittedAt", "packages"],
  });
  for (const approvalPackage of packagesToCreate) {
    await createSystemInboxItems(sql, {
      accountId, recipientUserIds: [approvalPackage.reviewerUserId], type: "weekly_submission_received",
      actorUserId: currentUser.id, subjectType: "weekly_submission", subjectId: submissionId,
      projectName: projects.find((project) => text(project.id) === text(approvalPackage.projectId))?.name || "Non-project time",
      message: `${member.displayName} submitted the week of ${weekStart} for your review.`,
      deepLink: { view: "entries", weeklyApproval: true, submissionId },
    });
  }
  return { submissionId, status: submissionStatus, weekStart, weekEnd, packageCount: packages.length };
}

async function reviewPackage(sql, { accountId, currentUser, payload }) {
  await ensureWeeklyApprovalSchema(sql);
  const packageId = text(payload?.packageId);
  const decision = text(payload?.decision).toLowerCase();
  const note = text(payload?.note);
  if (!packageId || !["approve", "request_changes"].includes(decision)) {
    throw Object.assign(new Error("Approval package and decision are required."), { statusCode: 400 });
  }
  if (decision === "request_changes" && !note) {
    throw Object.assign(new Error("Describe the changes requested."), { statusCode: 400 });
  }
  const rows = await sql`
    SELECT wp.*, ws.member_user_id AS "memberUserId", ws.week_start AS "weekStart",
           p.project_executive_id AS "projectExecutiveId", p.name AS "projectName", u.display_name AS "memberName"
    FROM weekly_approval_packages wp
    JOIN weekly_submissions ws ON ws.id = wp.submission_id AND ws.account_id = wp.account_id
    JOIN users u ON u.id = ws.member_user_id AND u.account_id = ws.account_id
    LEFT JOIN projects p ON p.id = wp.project_id AND p.account_id = wp.account_id
    WHERE wp.account_id = ${accountId}::uuid AND wp.id = ${packageId}::uuid LIMIT 1
  `;
  const approvalPackage = rows[0];
  if (!approvalPackage) throw Object.assign(new Error("Approval package not found."), { statusCode: 404 });
  if (text(approvalPackage.status) !== "submitted") {
    throw Object.assign(new Error("This approval package has already been reviewed."), { statusCode: 409 });
  }
  const actorId = text(currentUser?.id);
  const authorized = actorId === text(approvalPackage.reviewer_user_id)
    || actorId === text(approvalPackage.projectExecutiveId)
    || isAdministrative(currentUser);
  if (!authorized) throw Object.assign(new Error("You are not authorized to review this package."), { statusCode: 403 });
  const nextPackageStatus = decision === "approve" ? "approved" : "changes_requested";
  await sql`
    UPDATE weekly_approval_packages SET status = ${nextPackageStatus}, request_note = ${note || null},
      reviewed_at = NOW(), reviewed_by_user_id = ${actorId}, updated_at = NOW()
    WHERE account_id = ${accountId}::uuid AND id = ${packageId}::uuid
  `;
  await logAudit(sql, {
    accountId, entityType: "weekly_approval_package", entityId: packageId,
    action: decision === "approve" ? "approve" : "request_changes",
    changedByUserId: actorId, changedByNameSnapshot: currentUser.displayName,
    targetUserId: approvalPackage.memberUserId,
    contextProjectId: approvalPackage.project_id || null,
    beforeJson: { status: approvalPackage.status, requestNote: approvalPackage.request_note || null },
    afterJson: { status: nextPackageStatus, requestNote: note || null },
    changedFieldsJson: ["status", ...(note ? ["requestNote"] : [])],
  });
  const items = await sql`SELECT record_type AS "recordType", record_id AS "recordId" FROM weekly_approval_items WHERE account_id = ${accountId}::uuid AND package_id = ${packageId}::uuid`;
  const timeIds = items.filter((item) => item.recordType === "time").map((item) => item.recordId);
  const expenseIds = items.filter((item) => item.recordType === "expense").map((item) => item.recordId);
  if (timeIds.length) await sql`
    UPDATE entries SET status = ${decision === "approve" ? "approved" : "pending"},
      approved_at = ${decision === "approve" ? new Date().toISOString() : null},
      approved_by_user_id = ${decision === "approve" ? actorId : null}, updated_at = NOW()
    WHERE account_id = ${accountId}::uuid AND id::text = ANY(${timeIds})
  `;
  if (expenseIds.length) await sql`
    UPDATE expenses SET status = ${decision === "approve" ? "approved" : "pending"},
      approved_at = ${decision === "approve" ? new Date().toISOString() : null}, updated_at = ${new Date().toISOString()}
    WHERE account_id = ${accountId}::uuid AND id::text = ANY(${expenseIds})
  `;
  const statuses = await sql`SELECT status FROM weekly_approval_packages WHERE account_id = ${accountId}::uuid AND submission_id = ${approvalPackage.submission_id}`;
  const derivedStatus = deriveSubmissionStatus(statuses.map((row) => row.status));
  const submissionStatus = derivedStatus === "approved" ? "locked" : derivedStatus;
  await sql`
    UPDATE weekly_submissions SET status = ${submissionStatus},
      approved_at = ${submissionStatus === "locked" ? new Date().toISOString() : null},
      locked_at = ${submissionStatus === "locked" ? new Date().toISOString() : null}, updated_at = NOW()
    WHERE account_id = ${accountId}::uuid AND id = ${approvalPackage.submission_id}
  `;
  await createSystemInboxItems(sql, {
    accountId, recipientUserIds: [approvalPackage.memberUserId],
    type: decision === "approve" ? "weekly_package_approved" : "weekly_changes_requested",
    actorUserId: actorId, subjectType: "weekly_submission", subjectId: text(approvalPackage.submission_id),
    projectName: approvalPackage.projectName || "Non-project time",
    message: decision === "approve"
      ? `${currentUser.displayName} approved ${approvalPackage.projectName || "the non-project portion"} for your week of ${String(approvalPackage.weekStart).slice(0, 10)}.`
      : `${currentUser.displayName} requested changes to ${approvalPackage.projectName || "the non-project portion"} for your week of ${String(approvalPackage.weekStart).slice(0, 10)}.`,
    noteSnippet: note, deepLink: { view: "inputs", weeklyApproval: true, submissionId: text(approvalPackage.submission_id) },
  });
  return { packageId, packageStatus: nextPackageStatus, submissionStatus };
}

async function loadTeamOverview(sql, { accountId, currentUser, weekStart, weekEnd }) {
  const actorId = text(currentUser.id);
  const [departmentScopes, officeScopes] = await Promise.all([
    sql`SELECT office_id AS "officeId", department_id AS "departmentId" FROM department_lead_assignments WHERE account_id = ${accountId}::uuid AND user_id = ${actorId}`,
    sql`SELECT id FROM office_locations WHERE account_id = ${accountId}::uuid AND office_lead_user_id = ${actorId}`,
  ]);
  if (!isAdministrative(currentUser) && !departmentScopes.length && !officeScopes.length) return null;
  let members = await sql`
    SELECT id, display_name AS "displayName", office_id AS "officeId", department_id AS "departmentId"
    FROM users WHERE account_id = ${accountId}::uuid AND is_active = TRUE ORDER BY display_name
  `;
  if (!isAdministrative(currentUser)) {
    const officeIds = new Set(officeScopes.map((row) => text(row.id)));
    const departmentKeys = new Set(departmentScopes.map((row) => `${text(row.officeId)}:${text(row.departmentId)}`));
    members = members.filter((member) => officeIds.has(text(member.officeId)) || departmentKeys.has(`${text(member.officeId)}:${text(member.departmentId)}`));
  }
  const memberIds = members.map((member) => member.id);
  if (!memberIds.length) return { counts: { complete: 0, pending: 0, missing: 0, changesRequested: 0 }, exceptions: [], memberCount: 0 };
  const [submissionRows, hourRows] = await Promise.all([
    sql`
      SELECT member_user_id AS "memberUserId", status
      FROM weekly_submissions WHERE account_id = ${accountId}::uuid
        AND member_user_id = ANY(${memberIds}) AND week_start = ${weekStart}::date
    `,
    sql`
      SELECT user_id AS "memberUserId", COALESCE(SUM(hours), 0)::FLOAT8 AS hours
      FROM entries WHERE account_id = ${accountId}::uuid AND user_id = ANY(${memberIds})
        AND entry_date BETWEEN ${weekStart}::date AND ${weekEnd}::date AND deleted_at IS NULL
      GROUP BY user_id
    `,
  ]);
  const submissionByMember = new Map(submissionRows.map((row) => [text(row.memberUserId), text(row.status)]));
  const hoursByMember = new Map(hourRows.map((row) => [text(row.memberUserId), Number(row.hours || 0)]));
  const counts = { complete: 0, pending: 0, missing: 0, changesRequested: 0 };
  const exceptions = [];
  for (const member of members) {
    const status = submissionByMember.get(text(member.id)) || "missing";
    const enteredHours = hoursByMember.get(text(member.id)) || 0;
    if (status === "approved" || status === "locked") counts.complete += 1;
    else if (status === "changes_requested") counts.changesRequested += 1;
    else if (status === "submitted" || status === "partially_approved") counts.pending += 1;
    else counts.missing += 1;
    if (!["approved", "locked"].includes(status)) {
      exceptions.push({ memberUserId: member.id, memberName: member.displayName, status, enteredHours });
    }
  }
  return { counts, exceptions: exceptions.slice(0, 100), memberCount: members.length };
}

async function listWorkflow(sql, { accountId, currentUser, payload }) {
  await ensureWeeklyApprovalSchema(sql);
  const { weekStart, weekEnd } = weekBounds(payload?.weekStart || new Date());
  const ownRows = await sql`
    SELECT id, TO_CHAR(week_start, 'YYYY-MM-DD') AS "weekStart", TO_CHAR(week_end, 'YYYY-MM-DD') AS "weekEnd",
      status, member_note AS "memberNote", submitted_at AS "submittedAt", approved_at AS "approvedAt", locked_at AS "lockedAt"
    FROM weekly_submissions WHERE account_id = ${accountId}::uuid AND member_user_id = ${text(currentUser.id)} AND week_start = ${weekStart}::date LIMIT 1
  `;
  const reviewQueue = await sql`
    SELECT wp.id, wp.package_type AS "packageType", wp.project_id AS "projectId", wp.status,
      wp.request_note AS "requestNote", ws.id AS "submissionId",
      TO_CHAR(ws.week_start, 'YYYY-MM-DD') AS "weekStart", TO_CHAR(ws.week_end, 'YYYY-MM-DD') AS "weekEnd",
      u.display_name AS "memberName", p.name AS "projectName",
      COUNT(wi.id)::INT AS "recordCount",
      COUNT(wi.id) FILTER (WHERE wi.record_type = 'time')::INT AS "timeCount",
      COUNT(wi.id) FILTER (WHERE wi.record_type = 'expense')::INT AS "expenseCount",
      COALESCE(SUM(e.hours) FILTER (WHERE wi.record_type = 'time'), 0)::FLOAT8 AS "timeHours",
      COALESCE(SUM(x.amount) FILTER (WHERE wi.record_type = 'expense'), 0)::FLOAT8 AS "expenseAmount"
    FROM weekly_approval_packages wp
    JOIN weekly_submissions ws ON ws.id = wp.submission_id AND ws.account_id = wp.account_id
    JOIN users u ON u.id = ws.member_user_id AND u.account_id = ws.account_id
    LEFT JOIN projects p ON p.id = wp.project_id AND p.account_id = wp.account_id
    LEFT JOIN weekly_approval_items wi ON wi.package_id = wp.id AND wi.account_id = wp.account_id
    LEFT JOIN entries e ON wi.record_type = 'time' AND e.account_id = wi.account_id AND e.id::text = wi.record_id
    LEFT JOIN expenses x ON wi.record_type = 'expense' AND x.account_id = wi.account_id AND x.id::text = wi.record_id
    WHERE wp.account_id = ${accountId}::uuid
      AND (wp.reviewer_user_id = ${text(currentUser.id)} OR p.project_executive_id = ${text(currentUser.id)} OR ${isAdministrative(currentUser)})
      AND wp.status = 'submitted'
    GROUP BY wp.id, ws.id, u.display_name, p.name
    ORDER BY ws.week_start DESC, u.display_name, p.name NULLS LAST
  `;
  const reviewPackageIds = reviewQueue.map((item) => item.id);
  const reviewItems = reviewPackageIds.length ? await sql`
    SELECT wi.package_id AS "packageId", wi.record_type AS "recordType", wi.record_id AS "recordId",
      COALESCE(TO_CHAR(e.entry_date, 'YYYY-MM-DD'), x.expense_date) AS date,
      COALESCE(e.client_name, x.client_name) AS "clientName",
      COALESCE(e.project_name, x.project_name) AS "projectName",
      e.task, COALESCE(e.notes, x.notes, '') AS notes,
      COALESCE(e.hours, 0)::FLOAT8 AS hours, COALESCE(x.amount, 0)::FLOAT8 AS amount
    FROM weekly_approval_items wi
    LEFT JOIN entries e ON wi.record_type = 'time' AND e.account_id = wi.account_id AND e.id::text = wi.record_id
    LEFT JOIN expenses x ON wi.record_type = 'expense' AND x.account_id = wi.account_id AND x.id::text = wi.record_id
    WHERE wi.account_id = ${accountId}::uuid AND wi.package_id = ANY(${reviewPackageIds}::uuid[])
    ORDER BY date, wi.record_type, wi.created_at
  ` : [];
  const reviewItemsByPackage = new Map();
  for (const item of reviewItems) {
    const packageId = text(item.packageId);
    if (!reviewItemsByPackage.has(packageId)) reviewItemsByPackage.set(packageId, []);
    reviewItemsByPackage.get(packageId).push(item);
  }
  const ownPackages = ownRows[0] ? await sql`
    SELECT wp.id, wp.package_type AS "packageType", wp.project_id AS "projectId", wp.status,
      wp.request_note AS "requestNote", p.name AS "projectName", u.display_name AS "reviewerName"
    FROM weekly_approval_packages wp
    LEFT JOIN projects p ON p.id = wp.project_id AND p.account_id = wp.account_id
    JOIN users u ON u.id = wp.reviewer_user_id AND u.account_id = wp.account_id
    WHERE wp.account_id = ${accountId}::uuid AND wp.submission_id = ${ownRows[0].id}
    ORDER BY p.name NULLS LAST
  ` : [];
  const records = await loadWeekRecords(sql, { accountId, memberUserId: text(currentUser.id), weekStart, weekEnd });
  const teamOverview = await loadTeamOverview(sql, { accountId, currentUser, weekStart, weekEnd });
  return {
    weekStart, weekEnd,
    ownSubmission: ownRows[0] ? { ...ownRows[0], packages: ownPackages } : null,
    ownTotals: {
      timeHours: records.reduce((sum, record) => sum + Number(record.hours || 0), 0),
      expenseAmount: records.reduce((sum, record) => sum + Number(record.amount || 0), 0),
      recordCount: records.length,
    },
    reviewQueue: reviewQueue.map((item) => ({ ...item, items: reviewItemsByPackage.get(text(item.id)) || [] })),
    teamOverview,
  };
}

module.exports = { assertRecordEditable, assertStandaloneApprovalAllowed, ensureWeeklyApprovalSchema, listWorkflow, reviewPackage, submitWeek };
