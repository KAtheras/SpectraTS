"use strict";

module.exports = {
  id: "006_weekly_approval_workflow",
  async up(sql) {
    await sql`
      CREATE TABLE IF NOT EXISTS weekly_submissions (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'submitted', 'partially_approved', 'changes_requested', 'approved', 'locked')),
        member_note TEXT,
        submitted_at TIMESTAMPTZ,
        submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMPTZ,
        locked_at TIMESTAMPTZ,
        reopened_at TIMESTAMPTZ,
        reopened_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        reopen_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (account_id, member_user_id, week_start)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS weekly_approval_packages (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        submission_id UUID NOT NULL REFERENCES weekly_submissions(id) ON DELETE CASCADE,
        package_key TEXT NOT NULL,
        package_type TEXT NOT NULL CHECK (package_type IN ('project', 'non_project')),
        project_id BIGINT REFERENCES projects(id) ON DELETE RESTRICT,
        reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'submitted'
          CHECK (status IN ('submitted', 'changes_requested', 'approved')),
        request_note TEXT,
        reviewed_at TIMESTAMPTZ,
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (submission_id, package_key)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS weekly_approval_items (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        submission_id UUID NOT NULL REFERENCES weekly_submissions(id) ON DELETE CASCADE,
        package_id UUID NOT NULL REFERENCES weekly_approval_packages(id) ON DELETE CASCADE,
        record_type TEXT NOT NULL CHECK (record_type IN ('time', 'expense')),
        record_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (submission_id, record_type, record_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS weekly_submissions_member_week_idx ON weekly_submissions(account_id, member_user_id, week_start DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS weekly_packages_reviewer_status_idx ON weekly_approval_packages(account_id, reviewer_user_id, status, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS weekly_items_record_idx ON weekly_approval_items(account_id, record_type, record_id)`;
  },
};
