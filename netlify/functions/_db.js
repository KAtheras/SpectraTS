"use strict";

const crypto = require("crypto");
const { neon } = require("@netlify/neon");
const permissions = require("./permissions");

const DEFAULT_CLIENT_PROJECTS = {};

const SESSION_TTL_DAYS = 14;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

const DELEGATION_CAPABILITIES = new Set([
  "enter_time_on_behalf",
  "enter_expenses_on_behalf",
  "view_time_on_behalf",
  "view_expenses_on_behalf",
  "view_reports_on_behalf",
  "create_reports_on_behalf",
  "print_reports_on_behalf",
]);

const ACTING_AS_CAPABILITIES = new Set([
  "enter_time_on_behalf",
  "enter_expenses_on_behalf",
  "view_time_on_behalf",
  "view_expenses_on_behalf",
]);

async function getSql() {
  return neon();
}

async function ensureDefaultAccount(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const existing = await sql`
    SELECT id
    FROM accounts
    ORDER BY created_at
    LIMIT 1
  `;

  if (existing[0]?.id) {
    return existing[0].id;
  }

  const inserted = await sql`
    INSERT INTO accounts (id, name)
    VALUES (${randomId()}, 'Default')
    RETURNING id
  `;
  return inserted[0].id;
}

async function ensureSchema(sql) {
  const accountId = await ensureDefaultAccount(sql);
  const accountUuid = accountId ? `${accountId}` : accountId;

  // Permission schema (global, not per-account yet) driven by workbook seeds
  await sql`
    CREATE TABLE IF NOT EXISTS permission_roles (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      is_global BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS permission_capabilities (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      category TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS permission_scopes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      role_id BIGINT NOT NULL REFERENCES permission_roles(id) ON DELETE CASCADE,
      capability_id BIGINT NOT NULL REFERENCES permission_capabilities(id) ON DELETE CASCADE,
      scope_id BIGINT NOT NULL REFERENCES permission_scopes(id) ON DELETE CASCADE,
      allowed BOOLEAN NOT NULL DEFAULT FALSE,
      subject_role_max TEXT NULL,
      allow_self BOOLEAN NOT NULL DEFAULT FALSE,
      policy_key TEXT NULL,
      UNIQUE (role_id, capability_id, scope_id)
    )
  `;

  await sql`
    INSERT INTO permission_capabilities (key, label, category, is_active)
    VALUES ('can_delegate', 'Can delegate access', 'settings', TRUE)
    ON CONFLICT (key) DO UPDATE SET
      label = EXCLUDED.label,
      category = EXCLUDED.category,
      is_active = EXCLUDED.is_active
  `;
  await sql`
    INSERT INTO role_permissions (role_id, capability_id, scope_id, allowed)
    SELECT pr.id, pc.id, ps.id, TRUE
    FROM permission_roles pr
    JOIN permission_capabilities pc ON pc.key = 'can_delegate'
    JOIN permission_scopes ps ON ps.key = 'own_office'
    WHERE pr.key IN ('manager', 'executive', 'admin', 'superuser')
    ON CONFLICT (role_id, capability_id, scope_id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      base_rate NUMERIC(10,2),
      cost_rate NUMERIC(10,2),
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      level INT,
      office_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL,
      account_id UUID REFERENCES accounts(id),
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS base_rate NUMERIC(10,2)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cost_rate NUMERIC(10,2)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS office_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS department_id TEXT NULL REFERENCES departments(id) ON DELETE SET NULL
  `;

  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
  await sql`UPDATE users SET role = 'superuser' WHERE role = 'global_admin'`;
  await sql`UPDATE users SET role = 'staff' WHERE role = 'member'`;
  await sql`
    UPDATE users
    SET level = CASE
      WHEN level IS NOT NULL THEN level
      WHEN role = 'superuser' THEN 6
      WHEN role = 'manager' THEN 3
      ELSE 1
    END
  `;
  await sql`UPDATE users SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;
  await sql`UPDATE users SET email = '' WHERE email IS NULL`;
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_level_check`;
  await sql`
    ALTER TABLE users
    ADD CONSTRAINT users_level_check
    CHECK (level >= 1)
  `;

  await sql`
    DROP INDEX IF EXISTS users_username_ci_idx
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx
    ON users (account_id, LOWER(username))
  `;

  await sql`
    DROP INDEX IF EXISTS users_display_name_ci_idx
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_ci_idx
    ON users (account_id, LOWER(display_name))
    WHERE is_active = TRUE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      delegator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delegate_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      capability TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, delegator_user_id, delegate_user_id, capability)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS delegations_delegate_idx
      ON delegations (account_id, delegate_user_id, delegator_user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS delegations_delegator_idx
      ON delegations (account_id, delegator_user_id, delegate_user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_setup_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS password_setup_tokens_user_idx
      ON password_setup_tokens (user_id, account_id, used_at, expires_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account_id UUID REFERENCES accounts(id),
      name TEXT NOT NULL,
      office_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL,
      business_contact_first_name TEXT,
      business_contact_last_name TEXT,
      business_contact_email TEXT,
      business_contact_phone TEXT,
      client_address TEXT,
      admin_contact_first_name TEXT,
      admin_contact_last_name TEXT,
      admin_contact_email TEXT,
      admin_contact_phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)
  `;
  await sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS office_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL
  `;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_contact_name TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_contact_first_name TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_contact_last_name TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_contact_email TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_contact_phone TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_address TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_contact_name TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_contact_email TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_contact_phone TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_street TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_city TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_state TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_postal TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS admin_contact_first_name TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS admin_contact_last_name TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS admin_contact_email TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS admin_contact_phone TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`UPDATE clients SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;
  await sql`
    DROP INDEX IF EXISTS clients_name_ci_idx
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS clients_name_ci_idx
    ON clients (account_id, LOWER(name))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id),
      office_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      budget_amount NUMERIC(12,2)
    )
  `;

  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id)
  `;
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)
  `;
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS office_id TEXT NULL REFERENCES office_locations(id) ON DELETE SET NULL
  `;
  await sql`UPDATE projects SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2)
  `;
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS projects_client_name_ci_idx
    ON projects (client_id, LOWER(name))
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS manager_clients (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id),
      assigned_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manager_id, client_id)
    )
  `;
  await sql`
    ALTER TABLE manager_clients
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)
  `;
  await sql`UPDATE manager_clients SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS manager_projects (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id),
      charge_rate_override NUMERIC(10,2),
      assigned_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (manager_id, project_id)
    )
  `;
  await sql`
    ALTER TABLE manager_projects
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)
  `;
  await sql`UPDATE manager_projects SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;
  await sql`ALTER TABLE manager_projects ADD COLUMN IF NOT EXISTS charge_rate_override NUMERIC(10,2)`;

  await sql`
    CREATE TABLE IF NOT EXISTS project_members (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id),
      charge_rate_override NUMERIC(10,2),
      assigned_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, user_id)
    )
  `;
  await sql`
    ALTER TABLE project_members
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)
  `;
  await sql`UPDATE project_members SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;
  await sql`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS charge_rate_override NUMERIC(10,2)`;

  await sql`
    CREATE TABLE IF NOT EXISTS entries (
      id UUID PRIMARY KEY,
      user_name TEXT NOT NULL,
      entry_date DATE NOT NULL,
      client_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      task TEXT NOT NULL DEFAULT '',
      hours NUMERIC(10, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
      notes TEXT NOT NULL DEFAULT '',
      billable BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_at TIMESTAMPTZ,
      approved_by_user_id TEXT REFERENCES users(id),
      account_id UUID REFERENCES accounts(id),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id)
  `;
  await sql`UPDATE entries SET account_id = ${accountUuid}::uuid WHERE account_id IS NULL`;
  await sql`ALTER TABLE entries ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
  await sql`ALTER TABLE entries ADD COLUMN IF NOT EXISTS approved_by_user_id TEXT REFERENCES users(id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS level_labels (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      level INT NOT NULL,
      label TEXT NOT NULL,
      permission_group TEXT NOT NULL DEFAULT 'staff',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (account_id, level)
    )
  `;
  await sql`
    ALTER TABLE level_labels
    ADD COLUMN IF NOT EXISTS permission_group TEXT NOT NULL DEFAULT 'staff'
  `;
  await sql`ALTER TABLE level_labels DROP CONSTRAINT IF EXISTS level_labels_level_check`;

  await sql`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      account_uuid UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE departments DROP COLUMN IF EXISTS is_active`;
  await sql`ALTER TABLE expense_categories DROP COLUMN IF EXISTS is_active`;

  await sql`
    CREATE TABLE IF NOT EXISTS office_locations (
      id TEXT PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      office_lead_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      is_billable INT NOT NULL DEFAULT 1,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS expense_categories_account_idx
      ON expense_categories(account_uuid)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account_id UUID REFERENCES accounts(id),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changed_by_user_id TEXT,
      changed_by_name_snapshot TEXT,
      target_user_id TEXT,
      context_client_id BIGINT,
      context_project_id BIGINT,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      before_json JSONB,
      after_json JSONB,
      changed_fields_json JSONB
    )
  `;
  await sql`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS context_client_id BIGINT`;
  await sql`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS context_project_id BIGINT`;
  await sql`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS changed_fields_json JSONB`;
  await sql`
    CREATE INDEX IF NOT EXISTS audit_log_account_idx
      ON audit_log (account_id, changed_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      note_snippet TEXT NULL,
      project_name_snapshot TEXT NULL,
      deep_link_json JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS note_snippet TEXT`;
  await sql`
    CREATE INDEX IF NOT EXISTS inbox_items_recipient_idx
      ON inbox_items (account_id, recipient_user_id, is_read, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notification_rules (
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      inbox_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      recipient_scope TEXT NOT NULL,
      delivery_mode TEXT NOT NULL DEFAULT 'immediate',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (account_id, event_type)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS notification_rules_account_idx
      ON notification_rules (account_id, event_type)
  `;
  await ensureNotificationRulesForAccount(sql, accountUuid);
  await sql`ALTER TABLE level_labels DROP CONSTRAINT IF EXISTS level_labels_level_check`;

  const labelRows = await sql`
    SELECT level
    FROM level_labels
    WHERE account_id = ${accountUuid}::uuid
  `;
  const existingLevels = new Set(labelRows.map((row) => row.level));
  const defaultLabels = {
    1: "Staff",
    2: "Senior",
    3: "Manager",
    4: "Director",
    5: "Partner",
    6: "Admin",
  };
  // Only seed defaults for accounts with no level labels yet. If levels
  // exist, respect deliberate deletions.
  if (existingLevels.size === 0) {
    for (const [level, label] of Object.entries(defaultLabels)) {
      const levelInt = Number(level);
      await sql`
        INSERT INTO level_labels (account_id, level, label, permission_group)
        VALUES (${accountUuid}::uuid, ${levelInt}, ${label}, ${defaultPermissionGroup(levelInt)})
        ON CONFLICT (account_id, level) DO NOTHING
      `;
    }
  }

  await sql`
    UPDATE level_labels
    SET permission_group = CASE
      WHEN level >= 5 THEN 'admin'
      WHEN level >= 3 THEN 'manager'
      WHEN level >= 1 THEN 'staff'
      ELSE permission_group
    END
    WHERE (permission_group IS NULL OR permission_group = '')
      AND account_id = ${accountUuid}::uuid
  `;

  await sql`
    INSERT INTO project_members (project_id, user_id, account_id, assigned_by, created_at)
    SELECT DISTINCT
      projects.id,
      users.id,
      ${accountUuid}::uuid,
      users.id,
      NOW()
    FROM entries
    JOIN users ON LOWER(users.display_name) = LOWER(entries.user_name)
    JOIN clients ON LOWER(clients.name) = LOWER(entries.client_name)
    JOIN projects ON projects.client_id = clients.id
      AND LOWER(projects.name) = LOWER(entries.project_name)
    WHERE users.is_active = TRUE
      AND clients.account_id = ${accountUuid}::uuid
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;

  await seedDefaultCatalog(sql, accountUuid);
  await seedDefaultExpenseCategories(sql, accountUuid);
  await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
}

async function ensureNotificationRulesForAccount(sql, accountUuid) {
  if (!accountUuid) return;
  const notificationRuleSeeds = [
    {
      eventType: "time_entry_created",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "project_manager",
      deliveryMode: "immediate",
    },
    {
      eventType: "expense_entry_created",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "project_manager",
      deliveryMode: "immediate",
    },
    {
      eventType: "entry_approved",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "entry_owner",
      deliveryMode: "immediate",
    },
    {
      eventType: "expense_approved",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "expense_owner",
      deliveryMode: "immediate",
    },
    {
      eventType: "delegation_updated",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "delegated_member",
      deliveryMode: "immediate",
    },
    {
      eventType: "project_assignment_updated",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "assigned_member",
      deliveryMode: "immediate",
    },
    {
      eventType: "entry_billing_status_updated",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "entry_owner",
      deliveryMode: "immediate",
    },
    {
      eventType: "expense_billing_status_updated",
      enabled: true,
      inboxEnabled: true,
      emailEnabled: false,
      recipientScope: "expense_owner",
      deliveryMode: "immediate",
    },
  ];
  for (const rule of notificationRuleSeeds) {
    await sql`
      INSERT INTO notification_rules (
        account_id,
        event_type,
        enabled,
        inbox_enabled,
        email_enabled,
        recipient_scope,
        delivery_mode
      )
      VALUES (
        ${accountUuid}::uuid,
        ${rule.eventType},
        ${rule.enabled},
        ${rule.inboxEnabled},
        ${rule.emailEnabled},
        ${rule.recipientScope},
        ${rule.deliveryMode}
      )
      ON CONFLICT (account_id, event_type) DO NOTHING
    `;
  }
}

async function seedDefaultCatalog(sql, accountId) {
  const [{ count }] = await sql`
    SELECT COUNT(*)::INT AS count
    FROM clients
    WHERE account_id = ${accountId}::uuid
  `;
  if (count > 0) {
    return;
  }

  for (const [clientName, projects] of Object.entries(DEFAULT_CLIENT_PROJECTS)) {
    const inserted = await sql`
      INSERT INTO clients (account_id, name)
      VALUES (${accountId}::uuid, ${clientName})
      RETURNING id
    `;

    const clientId = inserted[0].id;
    for (const projectName of projects) {
      await sql`
        INSERT INTO projects (client_id, account_id, name)
        VALUES (${clientId}, ${accountId}::uuid, ${projectName})
      `;
    }
  }
}

async function seedDefaultExpenseCategories(sql, accountId) {
  const [{ count }] = await sql`
    SELECT COUNT(*)::INT AS count
    FROM expense_categories
    WHERE account_uuid = ${accountId}::uuid
  `;
  if (count > 0) {
    return;
  }
  const defaults = ["Travel", "Meals", "Lodging", "Supplies", "Mileage", "Other"];
  for (const name of defaults) {
    await sql`
      INSERT INTO expense_categories (id, account_uuid, name, created_at)
      VALUES (${randomId()}, ${accountId}::uuid, ${name}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }
}

function json(statusCode, body, extraHeaders) {
  const headers = {
    ...JSON_HEADERS,
  };
  const multiValueHeaders = {};

  Object.entries(extraHeaders || {}).forEach(function ([key, value]) {
    if (key.toLowerCase() === "set-cookie") {
      multiValueHeaders["Set-Cookie"] = Array.isArray(value) ? value : [value];
      return;
    }

    headers[key] = value;
  });

  return {
    statusCode,
    headers,
    ...(Object.keys(multiValueHeaders).length ? { multiValueHeaders } : {}),
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, message, extra) {
  return json(statusCode, { error: message, ...(extra || {}) });
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return null;
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLevel(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  const raw = normalizeText(value).toLowerCase();
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1) {
    return numeric;
  }
  if (raw === "staff") return 1;
  if (raw === "senior") return 2;
  if (raw === "manager") return 3;
  if (raw === "director") return 4;
  if (raw === "partner") return 5;
  if (raw === "admin" || raw === "superuser") return 6;
  if (raw === "member") return 1;
  return 1;
}

function isSuperAdminLevel(level) {
  return normalizeLevel(level) >= 6;
}

function isAdminLevel(level) {
  return normalizeLevel(level) >= 5;
}

function isManagerLevel(level) {
  const normalized = normalizeLevel(level);
  return normalized >= 3;
}

function defaultPermissionGroup(level) {
  const normalized = normalizeLevel(level);
  if (normalized >= 5) return "admin";
  if (normalized >= 3) return "manager";
  return "staff";
}

function permissionGroupForLevel(level) {
  const normalized = normalizeLevel(level);
  if (normalized >= 5) return "admin";
  if (normalized >= 3) return "manager";
  return "staff";
}

function permissionGroupForUser(user, levelLabels) {
  if (!user && user !== 0) return "staff";

  const raw =
    (typeof user === "object" && user !== null
      ? user.permissionGroup || user.permission_group || user.role
      : user) || "";
  const normalized = normalizeText(raw);
  if (normalized) return normalized;

  const levelValue =
    typeof user === "number"
      ? user
      : typeof user === "object" && user !== null
        ? user.level
        : null;
  if (levelLabels && levelValue !== null && levelValue !== undefined) {
    const levelKey = normalizeLevel(levelValue);
    const mapped =
      levelLabels?.[levelKey]?.permissionGroup ||
      levelLabels?.[levelKey]?.permission_group;
    const mappedNormalized = normalizeText(mapped || "");
    if (mappedNormalized) return mappedNormalized;
  }

  return "staff";
}

function isAdmin(user, levelLabels) {
  const group = permissionGroupForUser(user, levelLabels);
  return group === "admin" || group === "superuser";
}

function isExecutive(user, levelLabels) {
  const group = permissionGroupForUser(user, levelLabels);
  return group === "executive" || group === "admin" || group === "superuser";
}

function isManager(user, levelLabels) {
  const group = permissionGroupForUser(user, levelLabels);
  return (
    group === "manager" ||
    group === "executive" ||
    group === "admin" ||
    group === "superuser"
  );
}

function isStaff(user, levelLabels) {
  return permissionGroupForUser(user, levelLabels) === "staff";
}

function randomId() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, existing] = String(storedHash || "").split(":");
  if (!salt || !existing) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(existing, "hex"), Buffer.from(derived, "hex"));
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getBearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1] : "";
}

function getCustomSessionToken(event) {
  return (
    event.headers?.["x-spectra-session"] ||
    event.headers?.["X-Spectra-Session"] ||
    ""
  );
}

function getSessionToken(event, request) {
  return String(
    getCustomSessionToken(event) ||
      getBearerToken(event) ||
      ""
  ).trim();
}

async function userCount(sql) {
  const rows = await sql`
    SELECT COUNT(*)::INT AS count
    FROM users
    WHERE is_active = TRUE
  `;
  return rows[0]?.count || 0;
}

async function findUserByUsername(sql, username, accountId) {
  const normalized = normalizeText(username);
  if (!normalized) {
    return null;
  }

  const rows = accountId
    ? await sql`
        SELECT *
        FROM users
        WHERE LOWER(username) = LOWER(${normalized})
          AND account_id = ${accountId}::uuid
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM users
        WHERE LOWER(username) = LOWER(${normalized})
        LIMIT 1
      `;

  return rows[0] || null;
}

async function findUserById(sql, id, accountId) {
  const normalized = normalizeText(id);
  if (!normalized) {
    return null;
  }

  const rows = accountId
    ? await sql`
        SELECT *
        FROM users
        WHERE id = ${normalized}
          AND account_id = ${accountId}::uuid
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM users
        WHERE id = ${normalized}
        LIMIT 1
      `;

  return rows[0] || null;
}

async function findUserByDisplayName(sql, displayName, accountId) {
  const normalized = normalizeText(displayName);
  if (!normalized) {
    return null;
  }

  const rows = accountId
    ? await sql`
        SELECT *
        FROM users
        WHERE LOWER(display_name) = LOWER(${normalized})
          AND is_active = TRUE
          AND account_id = ${accountId}::uuid
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM users
        WHERE LOWER(display_name) = LOWER(${normalized})
          AND is_active = TRUE
        LIMIT 1
      `;

  return rows[0] || null;
}

async function listUsers(sql, accountId) {
  const rows = await sql`
    SELECT
      users.id,
      users.username,
      users.email,
      users.display_name AS "displayName",
      users.role,
      users.level,
      users.base_rate AS "baseRate",
      users.cost_rate AS "costRate",
      users.office_id AS "officeId",
      offices.name AS "officeName",
      users.department_id AS "departmentId",
      d.name AS "departmentName",
      users.must_change_password AS "mustChangePassword",
      users.account_id AS "accountId",
      users.is_active AS "isActive",
      users.created_at AS "createdAt"
    FROM users
    LEFT JOIN departments d
      ON d.id = users.department_id
     AND d.account_id = ${accountId}::uuid
    LEFT JOIN office_locations offices
      ON offices.id = users.office_id
     AND offices.account_id = ${accountId}::uuid
    WHERE users.is_active = TRUE
      AND users.account_id = ${accountId}::uuid
    ORDER BY LOWER(users.display_name), LOWER(users.username)
  `;
  return rows.map((row) => ({ ...row, level: normalizeLevel(row.level) }));
}

async function adminCount(sql, accountId) {
  const rows = await sql`
    SELECT COUNT(*)::INT AS count
    FROM users
    LEFT JOIN level_labels
      ON level_labels.account_id = users.account_id
     AND level_labels.level = users.level
    WHERE users.is_active = TRUE
      AND users.account_id = ${accountId}::uuid
      AND COALESCE(
            level_labels.permission_group,
            CASE
              WHEN users.level >= 5 THEN 'admin'
              WHEN users.level >= 3 THEN 'manager'
              ELSE 'staff'
            END
          ) IN ('admin', 'superuser')
  `;
  return rows[0]?.count || 0;
}

async function listLevelLabels(sql, accountId) {
  let rows = [];
  try {
    rows = await sql`
      SELECT level, label, permission_group
      FROM level_labels
      WHERE account_id = ${accountId}::uuid
      ORDER BY level
    `;
  } catch (error) {
    // If permission_group is missing (older schema), add it and retry once.
    await sql`
      ALTER TABLE level_labels
      ADD COLUMN IF NOT EXISTS permission_group TEXT NOT NULL DEFAULT 'staff'
    `;
    rows = await sql`
      SELECT level, label, permission_group
      FROM level_labels
      WHERE account_id = ${accountId}::uuid
      ORDER BY level
    `;
  }
  const labels = {};
  rows.forEach((row) => {
    labels[row.level] = {
      label: row.label,
      permissionGroup: row.permission_group,
    };
  });
  return labels;
}

async function createUserRecord(sql, payload) {
  const username = normalizeText(payload.username);
  const email = normalizeText(payload.email);
  const displayName = normalizeText(payload.displayName);
  const password = String(payload.password || "");
  const level = normalizeLevel(payload.level ?? payload.role);
  const officeId = normalizeText(payload.officeId ?? payload.office_id);
  const baseRate =
    payload.baseRate !== undefined && payload.baseRate !== null && payload.baseRate !== ""
      ? Number(payload.baseRate)
      : null;
  const costRate =
    payload.costRate !== undefined && payload.costRate !== null && payload.costRate !== ""
      ? Number(payload.costRate)
      : null;
  const mustChangePassword =
    payload.mustChangePassword === false || payload.mustChangePassword === "false"
      ? false
      : true;
  const accountId = normalizeText(payload.accountId);
  const accountUuid = accountId ? `${accountId}` : accountId;
  if (!accountUuid) {
    throw new Error("Account is required.");
  }

  if (!username) {
    throw new Error("Username is required.");
  }
  if (!displayName) {
    throw new Error("Display name is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Email is required.");
  }
  const passwordValue =
    password.length >= 8
      ? password
      : `${crypto.randomUUID()}${crypto.randomBytes(12).toString("hex")}`;
  if (baseRate !== null && !(Number.isFinite(baseRate) && baseRate >= 0)) {
    throw new Error("Base rate must be a non-negative number.");
  }
  if (costRate !== null && !(Number.isFinite(costRate) && costRate >= 0)) {
    throw new Error("Cost rate must be a non-negative number.");
  }

  const existingUsername = await sql`
    SELECT *
    FROM users
    WHERE LOWER(username) = LOWER(${username})
      AND account_id = ${accountUuid}::uuid
    LIMIT 1
  `;
  if (existingUsername[0]?.is_active) {
    throw new Error("That username already exists.");
  }

  const existingDisplayName = await sql`
    SELECT id
    FROM users
    WHERE LOWER(display_name) = LOWER(${displayName})
      AND is_active = TRUE
      AND account_id = ${accountUuid}::uuid
    LIMIT 1
  `;
  if (existingDisplayName[0]) {
    throw new Error("That team member name already exists.");
  }

  const now = new Date().toISOString();

  const levelLabels = await listLevelLabels(sql, accountUuid);
  if (!levelLabels[level]) {
    throw new Error("Invalid level.");
  }
  const mappedRole =
    levelLabels[level]?.permissionGroup || levelLabels[level]?.permission_group || "staff";

  if (existingUsername[0] && !existingUsername[0].is_active) {
    const userRecord = existingUsername[0];
    await sql`
      UPDATE users
      SET
        display_name = ${displayName},
      email = ${email},
      password_hash = ${hashPassword(passwordValue)},
      level = ${level},
      role = ${mappedRole},
      base_rate = ${baseRate},
      cost_rate = ${costRate},
      office_id = ${officeId},
      is_active = TRUE,
      must_change_password = ${mustChangePassword},
      updated_at = ${now}
    WHERE id = ${userRecord.id}
  `;
    return {
      id: userRecord.id,
      username,
      email,
      displayName,
      level,
      role: mappedRole,
      baseRate,
      costRate,
      officeId: officeId || null,
      createdAt: userRecord.created_at,
      updatedAt: now,
      passwordHash: userRecord.password_hash,
      accountId: accountUuid,
    };
  }

  const user = {
    id: randomId(),
    username,
    email,
    displayName,
    level,
    role: mappedRole,
    baseRate,
    costRate,
    createdAt: now,
    updatedAt: now,
    passwordHash: hashPassword(passwordValue),
    accountId: accountUuid,
    officeId: officeId || null,
    mustChangePassword,
  };

  await sql`
    INSERT INTO users (
      id,
      username,
      email,
      display_name,
      password_hash,
      role,
      level,
      base_rate,
      cost_rate,
      office_id,
      must_change_password,
      account_id,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      ${user.id},
      ${user.username},
      ${user.email},
      ${user.displayName},
      ${user.passwordHash},
      ${user.role},
      ${user.level},
      ${user.baseRate},
      ${user.costRate},
      ${user.officeId},
      ${user.mustChangePassword},
      ${user.accountId}::uuid,
      TRUE,
      ${user.createdAt},
      ${user.updatedAt}
    )
  `;

  return user;
}

function hashSetupToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createPasswordSetupToken(sql, { userId, accountId, ttlHours = 48 }) {
  const token = `${crypto.randomUUID()}${crypto.randomBytes(20).toString("hex")}`;
  const tokenHash = hashSetupToken(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  await sql`
    UPDATE password_setup_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId}
      AND account_id = ${accountId}::uuid
      AND used_at IS NULL
  `;

  await sql`
    INSERT INTO password_setup_tokens (
      id,
      user_id,
      account_id,
      token_hash,
      expires_at
    )
    VALUES (
      ${randomId()},
      ${userId},
      ${accountId}::uuid,
      ${tokenHash},
      ${expiresAt}
    )
  `;

  await sql`
    UPDATE users
    SET must_change_password = TRUE,
        updated_at = NOW()
    WHERE id = ${userId}
      AND account_id = ${accountId}::uuid
  `;

  return { token, expiresAt };
}

async function updateUserRecord(sql, payload, actingUser) {
  const userId = normalizeText(payload.userId);
  const displayName = normalizeText(payload.displayName);
  const username = normalizeText(payload.username);
  const level = normalizeLevel(payload.level ?? payload.role);
  const officeId =
    payload.officeId !== undefined && payload.officeId !== null && payload.officeId !== ""
      ? normalizeText(payload.officeId)
      : payload.office_id !== undefined && payload.office_id !== null && payload.office_id !== ""
        ? normalizeText(payload.office_id)
        : null;
  const existingUser = await findUserById(sql, userId, actingUser?.accountId);
  const email =
    payload.email !== undefined && payload.email !== null && payload.email !== ""
      ? normalizeText(payload.email)
      : normalizeText(existingUser?.email || "");
  const rawBaseRate =
    payload.baseRate !== undefined && payload.baseRate !== null && payload.baseRate !== ""
      ? payload.baseRate
      : existingUser?.base_rate ?? null;
  const baseRate =
    rawBaseRate === null ? null : Number(rawBaseRate);
  const rawCostRate =
    payload.costRate !== undefined && payload.costRate !== null && payload.costRate !== ""
      ? payload.costRate
      : existingUser?.cost_rate ?? null;
  const costRate =
    rawCostRate === null ? null : Number(rawCostRate);

  if (!existingUser || !existingUser.is_active) {
    throw new Error("User not found.");
  }
  if (!displayName) {
    throw new Error("Display name is required.");
  }
  if (!username) {
    throw new Error("Username is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Email is required.");
  }

  const duplicateUsername = await sql`
    SELECT id
    FROM users
    WHERE LOWER(username) = LOWER(${username})
      AND id <> ${existingUser.id}
      AND is_active = TRUE
      AND account_id = ${existingUser.account_id}::uuid
    LIMIT 1
  `;
  if (duplicateUsername[0]) {
    throw new Error("That username already exists.");
  }

  const duplicateDisplayName = await sql`
    SELECT id
    FROM users
    WHERE LOWER(display_name) = LOWER(${displayName})
      AND id <> ${existingUser.id}
      AND is_active = TRUE
      AND account_id = ${existingUser.account_id}::uuid
    LIMIT 1
  `;
  if (duplicateDisplayName[0]) {
    throw new Error("That team member name already exists.");
  }
  if (baseRate !== null && !(Number.isFinite(baseRate) && baseRate >= 0)) {
    throw new Error("Base rate must be a non-negative number.");
  }
  if (costRate !== null && !(Number.isFinite(costRate) && costRate >= 0)) {
    throw new Error("Cost rate must be a non-negative number.");
  }

  const levelLabelMap = await listLevelLabels(sql, existingUser.account_id);
  if (!levelLabelMap[level]) {
    throw new Error("Invalid level.");
  }
  const mappedRole =
    levelLabelMap[level]?.permissionGroup || levelLabelMap[level]?.permission_group || existingUser.role;
  const currentIsAdmin = isAdmin(existingUser, levelLabelMap);
  const nextIsAdmin = isAdmin({ ...existingUser, level }, levelLabelMap);
  const admins = await adminCount(sql, existingUser.account_id);
  const adminsAfterChange = admins + (nextIsAdmin ? 1 : 0) - (currentIsAdmin ? 1 : 0);

  if (adminsAfterChange <= 0) {
    throw new Error("At least one Admin account is required.");
  }

  const wasManager = isManagerLevel(existingUser.level);
  const willBeManager = isManagerLevel(level);

  const updatedAt = new Date().toISOString();
  await sql`
    UPDATE users
    SET
      username = ${username},
      email = ${email},
      display_name = ${displayName},
      level = ${level},
      role = ${mappedRole},
      base_rate = ${baseRate},
      cost_rate = ${costRate},
      office_id = ${officeId},
      updated_at = ${updatedAt}
    WHERE id = ${existingUser.id}
  `;

  if (existingUser.display_name !== displayName) {
    await sql`
      UPDATE entries
      SET user_name = ${displayName}
      WHERE user_name = ${existingUser.display_name}
    `;
  }

  if (wasManager !== willBeManager) {
    await migrateAssignmentsOnLevelChange(sql, existingUser, level);
  }

  const refreshed = await findUserById(sql, existingUser.id, actingUser?.accountId);
  if (actingUser && actingUser.id === existingUser.id) {
    return {
      id: refreshed.id,
      username: refreshed.username,
      email: refreshed.email || "",
      displayName: refreshed.display_name,
      level: normalizeLevel(refreshed.level),
      baseRate: refreshed.base_rate ?? null,
      costRate: refreshed.cost_rate ?? null,
      officeId: refreshed.office_id || null,
      accountId: refreshed.account_id,
    };
  }

  return null;
}

async function migrateAssignmentsOnLevelChange(sql, existingUser, newLevel) {
  const accountId = existingUser.account_id;
  const userId = existingUser.id;
  const wasManager = isManagerLevel(existingUser.level);
  const willBeManager = isManagerLevel(newLevel);

  if (wasManager && !willBeManager) {
    // Move manager assignments to staff assignments
    const managerProjects = await sql`
      SELECT mp.project_id
      FROM manager_projects mp
      WHERE mp.manager_id = ${userId}
        AND mp.account_id = ${accountId}::uuid
    `;

    for (const row of managerProjects) {
      const projectId = row.project_id;
      const existingMember = await sql`
        SELECT 1 FROM project_members
        WHERE project_id = ${projectId}
          AND user_id = ${userId}
          AND account_id = ${accountId}::uuid
        LIMIT 1
      `;
      if (!existingMember[0]) {
        await sql`
          INSERT INTO project_members (project_id, user_id, account_id)
          VALUES (${projectId}, ${userId}, ${accountId}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }
    }

    await sql`
      DELETE FROM manager_projects
      WHERE manager_id = ${userId}
        AND account_id = ${accountId}::uuid
    `;
  } else if (!wasManager && willBeManager) {
    // Move staff assignments to manager assignments
    const memberProjects = await sql`
      SELECT project_id
      FROM project_members
      WHERE user_id = ${userId}
        AND account_id = ${accountId}::uuid
    `;

    for (const row of memberProjects) {
      const projectId = row.project_id;
      const existingManager = await sql`
        SELECT 1 FROM manager_projects
        WHERE project_id = ${projectId}
          AND manager_id = ${userId}
          AND account_id = ${accountId}::uuid
        LIMIT 1
      `;
      if (!existingManager[0]) {
        await sql`
          INSERT INTO manager_projects (manager_id, project_id, account_id)
          VALUES (${userId}, ${projectId}, ${accountId}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }
    }

    await sql`
      DELETE FROM project_members
      WHERE user_id = ${userId}
        AND account_id = ${accountId}::uuid
    `;
  }
}

async function updateUserPassword(sql, payload, accountId) {
  const userId = normalizeText(payload.userId);
  const password = String(payload.password || "");
  const existingUser = await findUserById(sql, userId, accountId);

  if (!existingUser || !existingUser.is_active) {
    throw new Error("User not found.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  await sql`
    UPDATE users
    SET
      password_hash = ${hashPassword(password)},
      must_change_password = ${payload.mustChangePassword === false ? false : true},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${existingUser.id}
  `;
}

async function deactivateUser(sql, payload, actingUser) {
  const userId = normalizeText(payload.userId);
  const existingUser = await findUserById(sql, userId, actingUser?.accountId);

  if (!existingUser || !existingUser.is_active) {
    throw new Error("User not found.");
  }
  if (actingUser && existingUser.id === actingUser.id) {
    throw new Error("You cannot deactivate your own account.");
  }
  const levelLabelMap = await listLevelLabels(sql, existingUser.account_id);
  if (isAdmin(existingUser, levelLabelMap)) {
    const admins = await adminCount(sql, existingUser.account_id);
    if (admins <= 1) {
      throw new Error("At least one Admin account is required.");
    }
  }

  await sql`
    UPDATE users
    SET
      is_active = FALSE,
      updated_at = ${new Date().toISOString()}
    WHERE id = ${existingUser.id}
  `;

  await sql`DELETE FROM sessions WHERE user_id = ${existingUser.id}`;
}

async function getSessionContext(sql, event, request) {
  const users = await userCount(sql);
  if (users === 0) {
    return {
      bootstrapRequired: true,
      currentUser: null,
    };
  }

  const token = getSessionToken(event, request);
  if (!token) {
    return {
      bootstrapRequired: false,
      currentUser: null,
    };
  }

  const rows = await sql`
    SELECT
      users.id,
      users.username,
      users.display_name AS "displayName",
      users.role,
      users.level,
      users.office_id AS "officeId",
      users.department_id AS "departmentId",
      d.name AS "departmentName",
      users.account_id AS "accountId",
      level_labels.permission_group AS "permissionGroup"
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    LEFT JOIN departments d
      ON d.id = users.department_id
     AND d.account_id = users.account_id
    LEFT JOIN level_labels ON level_labels.account_id = users.account_id
      AND level_labels.level = users.level
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > NOW()
      AND users.is_active = TRUE
    LIMIT 1
  `;

  return {
    bootstrapRequired: false,
    currentUser: rows[0]
      ? {
          ...rows[0],
          role: rows[0].role,
          level: normalizeLevel(rows[0].level),
          permissionGroup: rows[0].permissionGroup,
          officeId: rows[0].officeId,
        }
      : null,
  };
}

async function createSession(sql, userId) {
  const token = `${crypto.randomUUID()}${crypto.randomBytes(12).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      expires_at
    )
    VALUES (
      ${randomId()},
      ${userId},
      ${hashToken(token)},
      ${expiresAt.toISOString()}
    )
  `;

  return {
    token,
  };
}

async function clearSession(sql, event) {
  const token = getSessionToken(event);
  if (token) {
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }

  return {};
}

function requireAuth(context) {
  return context.currentUser
    ? null
    : errorResponse(401, "Authentication required.", {
        bootstrapRequired: context.bootstrapRequired,
      });
}

function requireAdmin(context) {
  if (!context.currentUser) {
    return requireAuth(context);
  }

  return isAdmin(context.currentUser)
    ? null
    : errorResponse(403, "Admin access required.");
}

function requireSuperAdmin(context) {
  if (!context.currentUser) {
    return requireAuth(context);
  }

  const roleKey = permissions.roleKeyFromUser(context.currentUser);
  return roleKey === "superuser"
    ? null
    : errorResponse(403, "Superuser access required.");
}

async function findClient(sql, clientName, accountId) {
  const normalized = normalizeText(clientName);
  if (!normalized) {
    return null;
  }

  const rows = await sql`
    SELECT
      id,
      name,
      office_id AS office_id,
      business_contact_name,
      business_contact_first_name AS business_contact_first_name,
      business_contact_last_name AS business_contact_last_name,
      business_contact_email AS business_contact_email,
      business_contact_phone AS business_contact_phone,
      billing_contact_name,
      billing_contact_email,
      billing_contact_phone,
      client_address AS client_address,
      address_street,
      address_city,
      address_state,
      address_postal,
      admin_contact_first_name AS admin_contact_first_name,
      admin_contact_last_name AS admin_contact_last_name,
      admin_contact_email AS admin_contact_email,
      admin_contact_phone AS admin_contact_phone
    FROM clients
    WHERE LOWER(name) = LOWER(${normalized})
      AND account_id = ${accountId}::uuid
    LIMIT 1
  `;

  return rows[0] || null;
}

async function listClients(sql, accountId) {
  return sql`
    SELECT
      id,
      name,
      office_id AS "officeId",
      business_contact_name AS "businessContactName",
      business_contact_first_name AS "businessContactFirstName",
      business_contact_last_name AS "businessContactLastName",
      business_contact_email AS "businessContactEmail",
      business_contact_phone AS "businessContactPhone",
      billing_contact_name AS "billingContactName",
      billing_contact_email AS "billingContactEmail",
      billing_contact_phone AS "billingContactPhone",
      client_address AS "clientAddress",
      address_street AS "addressStreet",
      address_city AS "addressCity",
      address_state AS "addressState",
      address_postal AS "addressPostal",
      admin_contact_first_name AS "adminContactFirstName",
      admin_contact_last_name AS "adminContactLastName",
      admin_contact_email AS "adminContactEmail",
      admin_contact_phone AS "adminContactPhone",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM clients
    WHERE account_id = ${accountId}::uuid
    ORDER BY LOWER(name)
  `;
}

async function findProject(sql, clientName, projectName, accountId) {
  const client = await findClient(sql, clientName, accountId);
  const normalizedProject = normalizeText(projectName);
  if (!client || !normalizedProject) {
    return null;
  }

  const rows = await sql`
    SELECT
      projects.id,
      projects.client_id AS client_id,
      projects.name,
      clients.name AS client,
      projects.budget_amount AS budget
    FROM projects
    JOIN clients ON clients.id = projects.client_id
    WHERE projects.client_id = ${client.id}
      AND LOWER(projects.name) = LOWER(${normalizedProject})
      AND projects.account_id = ${accountId}::uuid
    LIMIT 1
  `;

  return rows[0] || null;
}

async function listProjects(sql, accountId) {
  return sql`
    SELECT
      projects.id,
      projects.name,
      clients.name AS client,
      projects.created_by AS "createdBy",
      projects.budget_amount AS budget,
      projects.office_id AS "officeId"
    FROM projects
    JOIN clients ON clients.id = projects.client_id
    WHERE projects.account_id = ${accountId}::uuid
    ORDER BY LOWER(clients.name), LOWER(projects.name)
  `;
}

async function listExpenseCategories(sql, accountId) {
  return sql`
    SELECT
      id,
      name
    FROM expense_categories
    WHERE account_uuid = ${accountId}::uuid
    ORDER BY created_at, LOWER(name)
  `;
}

async function listDepartments(sql, accountId) {
  return sql`
    SELECT
      id,
      name
    FROM departments
    WHERE account_id = ${accountId}::uuid
    ORDER BY LOWER(name)
  `;
}

async function listOfficeLocations(sql, accountId) {
  return sql`
    SELECT
      ol.id,
      ol.name,
      ol.office_lead_user_id AS "officeLeadUserId",
      u.display_name AS "officeLeadUserName"
    FROM office_locations ol
    LEFT JOIN users u
      ON u.id = ol.office_lead_user_id
     AND u.account_id = ol.account_id
    WHERE ol.account_id = ${accountId}::uuid
    ORDER BY ol.created_at, LOWER(ol.name)
  `;
}

async function listInboxItems(sql, accountId, recipientUserId) {
  if (!accountId || !recipientUserId) return [];
  return sql`
    SELECT
      id,
      type,
      recipient_user_id AS "recipientUserId",
      actor_user_id AS "actorUserId",
      subject_type AS "subjectType",
      subject_id AS "subjectId",
      message,
      note_snippet AS "noteSnippet",
      is_read AS "isRead",
      project_name_snapshot AS "projectNameSnapshot",
      deep_link_json AS "deepLink",
      created_at AS "createdAt"
    FROM inbox_items
    WHERE account_id = ${accountId}::uuid
      AND recipient_user_id = ${recipientUserId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
    LIMIT 200
  `;
}

async function listNotificationRules(sql, accountId) {
  if (!accountId) return [];
  return sql`
    SELECT
      event_type AS "eventType",
      enabled,
      inbox_enabled AS "inboxEnabled",
      email_enabled AS "emailEnabled",
      recipient_scope AS "recipientScope",
      delivery_mode AS "deliveryMode"
    FROM notification_rules
    WHERE account_id = ${accountId}::uuid
      AND event_type IN (
        'time_entry_created',
        'expense_entry_created',
        'entry_approved',
        'expense_approved',
        'delegation_updated',
        'project_assignment_updated',
        'entry_billing_status_updated',
        'expense_billing_status_updated'
      )
    ORDER BY event_type
  `;
}

async function listManagerClientAssignments(sql, accountId) {
  return sql`
    SELECT
      manager_clients.manager_id AS "managerId",
      clients.id AS "clientId",
      clients.name AS client
    FROM manager_clients
    JOIN clients ON clients.id = manager_clients.client_id
    WHERE manager_clients.account_id = ${accountId}::uuid
  `;
}

async function listManagerProjectAssignments(sql, accountId) {
  return sql`
    SELECT
      manager_projects.manager_id AS "managerId",
      projects.id AS "projectId",
      projects.name AS project,
      clients.name AS client,
      manager_projects.charge_rate_override AS "chargeRateOverride"
    FROM manager_projects
    JOIN projects ON projects.id = manager_projects.project_id
    JOIN clients ON clients.id = projects.client_id
    WHERE manager_projects.account_id = ${accountId}::uuid
  `;
}

async function listProjectMembers(sql, accountId) {
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      project_members.charge_rate_override AS "chargeRateOverride",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
   JOIN users ON users.id = project_members.user_id
    WHERE users.is_active = TRUE
      AND project_members.account_id = ${accountId}::uuid
  `;
}

async function listManagerAssignmentsForUser(sql, managerId, accountId) {
  const clientRows = await sql`
    SELECT
      manager_clients.manager_id AS "managerId",
      clients.id AS "clientId",
      clients.name AS client
    FROM manager_clients
    JOIN clients ON clients.id = manager_clients.client_id
    WHERE manager_clients.manager_id = ${managerId}
      AND manager_clients.account_id = ${accountId}::uuid
  `;
  const projectRows = await sql`
    SELECT
      manager_projects.manager_id AS "managerId",
      projects.id AS "projectId",
      projects.name AS project,
      clients.name AS client,
      manager_projects.charge_rate_override AS "chargeRateOverride"
    FROM manager_projects
    JOIN projects ON projects.id = manager_projects.project_id
    JOIN clients ON clients.id = projects.client_id
    WHERE manager_projects.manager_id = ${managerId}
      AND manager_projects.account_id = ${accountId}::uuid
  `;
  return { clientRows, projectRows };
}

async function listProjectMembersForUser(sql, userId, accountId) {
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      project_members.charge_rate_override AS "chargeRateOverride",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
    JOIN users ON users.id = project_members.user_id
    WHERE project_members.user_id = ${userId}
      AND users.is_active = TRUE
      AND project_members.account_id = ${accountId}::uuid
  `;
}

async function listProjectMembersForProjects(sql, projectIds, accountId) {
  if (!projectIds || !projectIds.length) {
    return [];
  }
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      project_members.charge_rate_override AS "chargeRateOverride",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
    JOIN users ON users.id = project_members.user_id
    WHERE project_members.project_id = ANY(${projectIds})
      AND users.is_active = TRUE
      AND project_members.account_id = ${accountId}::uuid
  `;
}

async function listProjectMembersForUsers(sql, userIds, accountId) {
  if (!userIds || !userIds.length) {
    return [];
  }
  return sql`
    SELECT
      project_members.project_id AS "projectId",
      project_members.user_id AS "userId",
      project_members.charge_rate_override AS "chargeRateOverride",
      users.display_name AS "userName",
      projects.name AS project,
      clients.name AS client
    FROM project_members
    JOIN projects ON projects.id = project_members.project_id
    JOIN clients ON clients.id = projects.client_id
    JOIN users ON users.id = project_members.user_id
    WHERE project_members.user_id = ANY(${userIds})
      AND users.is_active = TRUE
      AND project_members.account_id = ${accountId}::uuid
  `;
}

async function listManagerClientAssignmentsForManagers(sql, managerIds, accountId) {
  if (!managerIds || !managerIds.length) {
    return [];
  }
  return sql`
    SELECT
      manager_clients.manager_id AS "managerId",
      clients.id AS "clientId",
      clients.name AS client
    FROM manager_clients
    JOIN clients ON clients.id = manager_clients.client_id
    WHERE manager_clients.manager_id = ANY(${managerIds})
      AND manager_clients.account_id = ${accountId}::uuid
  `;
}

async function listManagerProjectAssignmentsForManagers(sql, managerIds, accountId) {
  if (!managerIds || !managerIds.length) {
    return [];
  }
  return sql`
    SELECT
      manager_projects.manager_id AS "managerId",
      projects.id AS "projectId",
      projects.name AS project,
      clients.name AS client,
      manager_projects.charge_rate_override AS "chargeRateOverride"
    FROM manager_projects
    JOIN projects ON projects.id = manager_projects.project_id
    JOIN clients ON clients.id = projects.client_id
    WHERE manager_projects.manager_id = ANY(${managerIds})
      AND manager_projects.account_id = ${accountId}::uuid
  `;
}

async function getManagerScope(sql, managerId, accountId) {
  const clientRows = await sql`
    SELECT client_id
    FROM manager_clients
    WHERE manager_id = ${managerId}
      AND account_id = ${accountId}::uuid
  `;
  const projectRows = await sql`
    SELECT project_id
    FROM manager_projects
    WHERE manager_id = ${managerId}
      AND account_id = ${accountId}::uuid
  `;
  // Managers may also be staff on projects via project_members; include those
  // so visibility/editing reflects actual assignments persisted in DB.
  const memberProjectRows = await sql`
    SELECT project_id
    FROM project_members
    WHERE user_id = ${managerId}
      AND account_id = ${accountId}::uuid
  `;
  const clientIds = clientRows.map((row) => row.client_id);
  const directProjectIds = projectRows.map((row) => row.project_id);
  const memberProjectIds = memberProjectRows.map((row) => row.project_id);
  const clientProjectRows = clientIds.length
    ? await sql`
        SELECT id
        FROM projects
        WHERE client_id = ANY(${clientIds})
      `
    : [];
  const projectIds = [
    ...new Set([
      ...directProjectIds,
      ...memberProjectIds,
      ...clientProjectRows.map((row) => row.id),
    ]),
  ];
  return { clientIds, projectIds };
}

async function listDelegatorsForDelegate(sql, delegateUserId, accountId) {
  const rows = await sql`
    SELECT
      d.delegator_user_id AS "delegatorUserId",
      u.display_name AS "delegatorName",
      d.capability
    FROM delegations d
    JOIN users u
      ON u.id = d.delegator_user_id
     AND u.account_id = d.account_id
     AND u.is_active = TRUE
    WHERE d.account_id = ${accountId}::uuid
      AND d.delegate_user_id = ${delegateUserId}
  `;

  const byDelegator = new Map();
  for (const row of rows) {
    const delegatorId = `${row.delegatorUserId || ""}`.trim();
    const capability = `${row.capability || ""}`.trim();
    if (!delegatorId || !ACTING_AS_CAPABILITIES.has(capability)) continue;
    if (!byDelegator.has(delegatorId)) {
      byDelegator.set(delegatorId, {
        id: delegatorId,
        name: `${row.delegatorName || ""}`.trim(),
        capabilities: [],
      });
    }
    const current = byDelegator.get(delegatorId);
    if (!current.capabilities.includes(capability)) {
      current.capabilities.push(capability);
    }
  }

  return Array.from(byDelegator.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

async function listMyDelegations(sql, delegatorUserId, accountId) {
  const rows = await sql`
    SELECT
      d.delegate_user_id AS "delegateUserId",
      u.display_name AS "delegateName",
      d.capability
    FROM delegations d
    JOIN users u
      ON u.id = d.delegate_user_id
     AND u.account_id = d.account_id
    WHERE d.account_id = ${accountId}::uuid
      AND d.delegator_user_id = ${delegatorUserId}
    ORDER BY LOWER(u.display_name), d.capability
  `;
  return rows
    .map((row) => ({
      delegateUserId: `${row.delegateUserId || ""}`.trim(),
      delegateName: `${row.delegateName || ""}`.trim(),
      capability: `${row.capability || ""}`.trim(),
    }))
    .filter(
      (row) =>
        row.delegateUserId &&
        row.delegateName &&
        DELEGATION_CAPABILITIES.has(row.capability)
    );
}

async function listDelegationCandidates(sql, currentUserId, accountId) {
  const rows = await sql`
    SELECT id, display_name AS "displayName"
    FROM users
    WHERE account_id = ${accountId}::uuid
      AND is_active = TRUE
      AND id <> ${currentUserId}
    ORDER BY LOWER(display_name)
  `;
  return rows.map((row) => ({
    id: `${row.id || ""}`.trim(),
    name: `${row.displayName || ""}`.trim(),
  }));
}

async function loadState(sql, currentUser) {
  const normalizedUser = currentUser
    ? {
        ...currentUser,
        permissionGroup:
          currentUser.permissionGroup || currentUser.permission_group || currentUser.permissiongroup,
        level: normalizeLevel(currentUser.level),
        officeId: currentUser.officeId ?? null,
        baseRate:
          currentUser.baseRate ?? currentUser.base_rate ?? null,
        costRate:
          currentUser.costRate ?? currentUser.cost_rate ?? null,
        mustChangePassword:
          currentUser.mustChangePassword ?? currentUser.must_change_password ?? false,
      }
    : null;
  const accountId = normalizedUser?.accountId || (await ensureDefaultAccount(sql));
  const accountUuid = accountId ? `${accountId}` : accountId;
  await ensureNotificationRulesForAccount(sql, accountUuid);
  const accountRow =
    accountUuid &&
    (
      await sql`
        SELECT id, name
        FROM accounts
        WHERE id = ${accountUuid}::uuid
        LIMIT 1
      `
    )[0];
  const isSuperAdmin = normalizedUser && isAdmin(normalizedUser); // keep legacy flag equivalent to admin group
  const levelLabels = await listLevelLabels(sql, accountUuid);
  const currentGroup = normalizedUser ? permissionGroupForUser(normalizedUser, levelLabels) : null;
  const isAdminFlag = currentGroup === "admin" || currentGroup === "superuser";
  const isExecFlag = currentGroup === "executive" || currentGroup === "superuser";
  const isManagerFlag = currentGroup === "manager" || isExecFlag || isAdminFlag;
  const isStaffFlag = currentGroup === "staff";
  if (normalizedUser) {
    normalizedUser.permissionGroup = currentGroup;
    normalizedUser.permission_group = currentGroup;
  }

  const permissionRows = await permissions.loadPermissionsFromDb(sql);
  const permissionIndex = permissions.buildIndex({ permissions: permissionRows });
  const roleKey = normalizedUser ? permissions.roleKeyFromUser(normalizedUser) : null;
  const canCap = (capability, ctx = {}) =>
    permissions.can(normalizedUser, capability, {
      permissionIndex,
      actorOfficeId: normalizedUser?.officeId ?? null,
      actorUserId: normalizedUser?.id ?? null,
      ...ctx,
    });
  const manageCategories = canCap("manage_expense_categories", {
    resourceOfficeId: normalizedUser?.officeId ?? null,
    actorOfficeId: normalizedUser?.officeId ?? null,
  });
  const manageLocations = canCap("manage_office_locations", {
    resourceOfficeId: normalizedUser?.officeId ?? null,
    actorOfficeId: normalizedUser?.officeId ?? null,
  });
  const editPermissionMatrix = canCap("edit_permission_matrix", {
    resourceOfficeId: normalizedUser?.officeId ?? null,
    actorOfficeId: normalizedUser?.officeId ?? null,
  });
  const viewMemberRatesCap = canCap("view_member_rates", {
    resourceOfficeId: normalizedUser?.officeId ?? null,
    actorOfficeId: normalizedUser?.officeId ?? null,
  });
  const editMemberRatesCap = canCap("edit_member_rates", {
    resourceOfficeId: normalizedUser?.officeId ?? null,
    actorOfficeId: normalizedUser?.officeId ?? null,
  });
  const settingsShell = Boolean(
    canCap("view_members", {
      resourceOfficeId: normalizedUser?.officeId ?? null,
      actorOfficeId: normalizedUser?.officeId ?? null,
    }) ||
    canCap("manage_levels", {
      resourceOfficeId: normalizedUser?.officeId ?? null,
      actorOfficeId: normalizedUser?.officeId ?? null,
    }) ||
    canCap("manage_departments", {
      resourceOfficeId: normalizedUser?.officeId ?? null,
      actorOfficeId: normalizedUser?.officeId ?? null,
    }) ||
    manageCategories ||
    manageLocations ||
    editPermissionMatrix ||
    canCap("can_delegate", {
      resourceOfficeId: normalizedUser?.officeId ?? null,
      actorOfficeId: normalizedUser?.officeId ?? null,
    })
  );
  const delegators = normalizedUser
    ? await listDelegatorsForDelegate(sql, normalizedUser.id, accountUuid)
    : [];
  const delegatorUserIds = Array.from(
    new Set(
      delegators
        .map((item) => `${item?.id || ""}`.trim())
        .filter(Boolean)
    )
  );

  const catalogRows = await sql`
    SELECT
      clients.name AS client,
      projects.name AS project
    FROM clients
    LEFT JOIN projects ON projects.client_id = clients.id
    WHERE clients.account_id = ${accountUuid}::uuid
    ORDER BY LOWER(clients.name), LOWER(projects.name)
  `;

  let clients = await listClients(sql, accountUuid);
  clients = clients.filter((client) =>
    canCap("view_clients", {
      resourceOfficeId: client.officeId ?? client.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    })
  );
  const allUsers = normalizedUser ? await listUsers(sql, accountUuid) : [];

  let entries = [];
  if (isAdminFlag) {
    entries = await sql`
      SELECT
        entries.id,
        entries.user_name AS "user",
        u.id AS "userId",
        TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
        entries.client_name AS client,
        entries.project_name AS project,
        entries.task,
        entries.hours::FLOAT8 AS hours,
        entries.notes,
        entries.billable,
        entries.status,
        entries.created_at AS "createdAt",
        entries.updated_at AS "updatedAt"
      FROM entries
      LEFT JOIN users u
        ON LOWER(u.display_name) = LOWER(entries.user_name)
       AND u.account_id = ${accountUuid}::uuid
      WHERE entries.account_id = ${accountUuid}::uuid
      ORDER BY entries.entry_date DESC, entries.created_at DESC
    `;
  } else if (isManagerFlag) {
    const scope = await getManagerScope(sql, normalizedUser.id, accountUuid);
    if (scope.projectIds.length) {
      entries = await sql`
        SELECT DISTINCT ON (entries.id)
          entries.id,
          entries.user_name AS "user",
          users.id AS "userId",
          TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
          entries.client_name AS client,
          entries.project_name AS project,
          entries.task,
          entries.hours::FLOAT8 AS hours,
          entries.notes,
          entries.billable,
          entries.status,
          entries.created_at AS "createdAt",
          entries.updated_at AS "updatedAt"
        FROM entries
        JOIN clients ON LOWER(clients.name) = LOWER(entries.client_name)
        JOIN projects ON projects.client_id = clients.id
          AND LOWER(projects.name) = LOWER(entries.project_name)
        JOIN users ON LOWER(users.display_name) = LOWER(entries.user_name)
        WHERE projects.id = ANY(${scope.projectIds})
          AND (users.level <= 2 OR users.id = ${normalizedUser.id})
          AND entries.account_id = ${accountUuid}::uuid
        ORDER BY entries.id, entries.entry_date DESC, entries.created_at DESC
      `;
    }
  } else if (normalizedUser && isStaffFlag) {
    entries = await sql`
      SELECT
        entries.id,
        entries.user_name AS "user",
        u.id AS "userId",
        TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
        entries.client_name AS client,
        entries.project_name AS project,
        entries.task,
        entries.hours::FLOAT8 AS hours,
        entries.notes,
        entries.billable,
        entries.status,
        entries.created_at AS "createdAt",
        entries.updated_at AS "updatedAt"
      FROM entries
      LEFT JOIN users u
        ON LOWER(u.display_name) = LOWER(entries.user_name)
       AND u.account_id = ${accountUuid}::uuid
      WHERE entries.user_name = ${normalizedUser.displayName}
        AND entries.account_id = ${accountUuid}::uuid
      ORDER BY entries.entry_date DESC, entries.created_at DESC
    `;
  }

  if (delegatorUserIds.length) {
    const delegatorRowsById = new Map(
      allUsers.map((item) => [`${item?.id || ""}`.trim(), item])
    );
    const timeDelegatorRows = delegators.filter((item) => {
      const caps = Array.isArray(item?.capabilities) ? item.capabilities : [];
      return (
        caps.includes("view_time_on_behalf") ||
        caps.includes("enter_time_on_behalf")
      );
    });
    const delegatorSelfOnlyIds = [];
    const delegatorManagerLikeIds = [];
    let includeAllDelegatorEntries = false;
    for (const delegator of timeDelegatorRows) {
      const delegatorId = `${delegator?.id || ""}`.trim();
      if (!delegatorId) continue;
      const delegatorUser = delegatorRowsById.get(delegatorId);
      const group = permissionGroupForUser(delegatorUser, levelLabels);
      if (group === "superuser" || group === "admin") {
        includeAllDelegatorEntries = true;
        continue;
      }
      if (group === "manager" || group === "executive") {
        delegatorManagerLikeIds.push(delegatorId);
      } else {
        delegatorSelfOnlyIds.push(delegatorId);
      }
    }

    const delegatedEntryRows = [];
    if (includeAllDelegatorEntries) {
      const rows = await sql`
        SELECT
          entries.id,
          entries.user_name AS "user",
          u.id AS "userId",
          TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
          entries.client_name AS client,
          entries.project_name AS project,
          entries.task,
          entries.hours::FLOAT8 AS hours,
          entries.notes,
          entries.billable,
          entries.status,
          entries.created_at AS "createdAt",
          entries.updated_at AS "updatedAt"
        FROM entries
        LEFT JOIN users u
          ON LOWER(u.display_name) = LOWER(entries.user_name)
         AND u.account_id = ${accountUuid}::uuid
        WHERE entries.account_id = ${accountUuid}::uuid
      `;
      delegatedEntryRows.push(...rows);
    } else {
      if (delegatorSelfOnlyIds.length) {
        const rows = await sql`
          SELECT
            entries.id,
            entries.user_name AS "user",
            u.id AS "userId",
            TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
            entries.client_name AS client,
            entries.project_name AS project,
            entries.task,
            entries.hours::FLOAT8 AS hours,
            entries.notes,
            entries.billable,
            entries.status,
            entries.created_at AS "createdAt",
            entries.updated_at AS "updatedAt"
          FROM entries
          JOIN users u
            ON LOWER(u.display_name) = LOWER(entries.user_name)
           AND u.account_id = ${accountUuid}::uuid
          WHERE entries.account_id = ${accountUuid}::uuid
            AND u.id = ANY(${delegatorSelfOnlyIds})
        `;
        delegatedEntryRows.push(...rows);
      }
      if (delegatorManagerLikeIds.length) {
        const projectIdSet = new Set();
        for (const managerId of delegatorManagerLikeIds) {
          const scope = await getManagerScope(sql, managerId, accountUuid);
          (scope.projectIds || []).forEach((id) => {
            if (id) projectIdSet.add(id);
          });
        }
        const scopeProjectIds = Array.from(projectIdSet);
        if (scopeProjectIds.length) {
          const rows = await sql`
            SELECT DISTINCT ON (entries.id)
              entries.id,
              entries.user_name AS "user",
              users.id AS "userId",
              TO_CHAR(entries.entry_date, 'YYYY-MM-DD') AS date,
              entries.client_name AS client,
              entries.project_name AS project,
              entries.task,
              entries.hours::FLOAT8 AS hours,
              entries.notes,
              entries.billable,
              entries.status,
              entries.created_at AS "createdAt",
              entries.updated_at AS "updatedAt"
            FROM entries
            JOIN clients ON LOWER(clients.name) = LOWER(entries.client_name)
            JOIN projects ON projects.client_id = clients.id
              AND LOWER(projects.name) = LOWER(entries.project_name)
            JOIN users ON LOWER(users.display_name) = LOWER(entries.user_name)
            WHERE entries.account_id = ${accountUuid}::uuid
              AND projects.id = ANY(${scopeProjectIds})
              AND (
                users.level <= 2
                OR users.id = ANY(${delegatorManagerLikeIds})
              )
            ORDER BY entries.id, entries.entry_date DESC, entries.created_at DESC
          `;
          delegatedEntryRows.push(...rows);
        }
      }
    }

    const delegatedEntries = delegatedEntryRows;
    const entryById = new Map();
    [...entries, ...delegatedEntries].forEach((item) => {
      if (!item?.id) return;
      entryById.set(item.id, item);
    });
    entries = Array.from(entryById.values()).sort((a, b) => {
      const leftDate = `${a?.date || ""}`;
      const rightDate = `${b?.date || ""}`;
      if (leftDate === rightDate) {
        return `${b?.createdAt || ""}`.localeCompare(`${a?.createdAt || ""}`);
      }
      return rightDate.localeCompare(leftDate);
    });
  }

  let expenses = [];
  if (isAdminFlag || isExecFlag) {
    expenses = await sql`
      SELECT
        id,
        user_id AS "userId",
        client_name AS "clientName",
        project_name AS "projectName",
        expense_date AS "expenseDate",
        category,
        amount::FLOAT8 AS amount,
        is_billable AS "isBillable",
        COALESCE(notes, '') AS notes,
        status,
        approved_at AS "approvedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM expenses
      WHERE account_id = ${accountUuid}::uuid
      ORDER BY expense_date DESC, created_at DESC NULLS LAST
    `;
  } else if (isManagerFlag) {
    const scope = await getManagerScope(sql, normalizedUser.id, accountUuid);
    if (scope.projectIds.length) {
      expenses = await sql`
        SELECT
          expenses.id,
          expenses.user_id AS "userId",
          expenses.client_name AS "clientName",
          expenses.project_name AS "projectName",
          expenses.expense_date AS "expenseDate",
          expenses.category,
          expenses.amount::FLOAT8 AS amount,
          expenses.is_billable AS "isBillable",
          COALESCE(expenses.notes, '') AS notes,
          expenses.status,
          expenses.approved_at AS "approvedAt",
          expenses.created_at AS "createdAt",
          expenses.updated_at AS "updatedAt"
        FROM expenses
        JOIN clients ON LOWER(clients.name) = LOWER(expenses.client_name)
        JOIN projects ON projects.client_id = clients.id
          AND LOWER(projects.name) = LOWER(expenses.project_name)
        WHERE expenses.account_id = ${accountUuid}::uuid
          AND projects.id = ANY(${scope.projectIds})
        ORDER BY expenses.expense_date DESC, expenses.created_at DESC NULLS LAST
      `;
    }
  } else if (normalizedUser && isStaffFlag) {
    expenses = await sql`
      SELECT
        id,
        user_id AS "userId",
        client_name AS "clientName",
        project_name AS "projectName",
        expense_date AS "expenseDate",
        category,
        amount::FLOAT8 AS amount,
        is_billable AS "isBillable",
        COALESCE(notes, '') AS notes,
        status,
        approved_at AS "approvedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM expenses
      WHERE account_id = ${accountUuid}::uuid
        AND user_id = ${normalizedUser.id}
      ORDER BY expense_date DESC, created_at DESC NULLS LAST
    `;
  }

  if (delegatorUserIds.length) {
    const delegatorRowsById = new Map(
      allUsers.map((item) => [`${item?.id || ""}`.trim(), item])
    );
    const expenseDelegatorRows = delegators.filter((item) => {
      const caps = Array.isArray(item?.capabilities) ? item.capabilities : [];
      return (
        caps.includes("view_expenses_on_behalf") ||
        caps.includes("enter_expenses_on_behalf")
      );
    });
    const delegatorSelfOnlyIds = [];
    const delegatorManagerLikeIds = [];
    let includeAllDelegatorExpenses = false;
    for (const delegator of expenseDelegatorRows) {
      const delegatorId = `${delegator?.id || ""}`.trim();
      if (!delegatorId) continue;
      const delegatorUser = delegatorRowsById.get(delegatorId);
      const group = permissionGroupForUser(delegatorUser, levelLabels);
      if (group === "superuser" || group === "admin" || group === "executive") {
        includeAllDelegatorExpenses = true;
        continue;
      }
      if (group === "manager") {
        delegatorManagerLikeIds.push(delegatorId);
      } else {
        delegatorSelfOnlyIds.push(delegatorId);
      }
    }

    const delegatedExpenseRows = [];
    if (includeAllDelegatorExpenses) {
      const rows = await sql`
        SELECT
          id,
          user_id AS "userId",
          client_name AS "clientName",
          project_name AS "projectName",
          expense_date AS "expenseDate",
          category,
          amount::FLOAT8 AS amount,
          is_billable AS "isBillable",
          COALESCE(notes, '') AS notes,
          status,
          approved_at AS "approvedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM expenses
        WHERE account_id = ${accountUuid}::uuid
      `;
      delegatedExpenseRows.push(...rows);
    } else {
      if (delegatorSelfOnlyIds.length) {
        const rows = await sql`
          SELECT
            id,
            user_id AS "userId",
            client_name AS "clientName",
            project_name AS "projectName",
            expense_date AS "expenseDate",
            category,
            amount::FLOAT8 AS amount,
            is_billable AS "isBillable",
            COALESCE(notes, '') AS notes,
            status,
            approved_at AS "approvedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM expenses
          WHERE account_id = ${accountUuid}::uuid
            AND user_id = ANY(${delegatorSelfOnlyIds})
        `;
        delegatedExpenseRows.push(...rows);
      }
      if (delegatorManagerLikeIds.length) {
        const projectIdSet = new Set();
        for (const managerId of delegatorManagerLikeIds) {
          const scope = await getManagerScope(sql, managerId, accountUuid);
          (scope.projectIds || []).forEach((id) => {
            if (id) projectIdSet.add(id);
          });
        }
        const scopeProjectIds = Array.from(projectIdSet);
        if (scopeProjectIds.length) {
          const rows = await sql`
            SELECT
              expenses.id,
              expenses.user_id AS "userId",
              expenses.client_name AS "clientName",
              expenses.project_name AS "projectName",
              expenses.expense_date AS "expenseDate",
              expenses.category,
              expenses.amount::FLOAT8 AS amount,
              expenses.is_billable AS "isBillable",
              COALESCE(expenses.notes, '') AS notes,
              expenses.status,
              expenses.approved_at AS "approvedAt",
              expenses.created_at AS "createdAt",
              expenses.updated_at AS "updatedAt"
            FROM expenses
            JOIN clients ON LOWER(clients.name) = LOWER(expenses.client_name)
            JOIN projects ON projects.client_id = clients.id
              AND LOWER(projects.name) = LOWER(expenses.project_name)
            WHERE expenses.account_id = ${accountUuid}::uuid
              AND projects.id = ANY(${scopeProjectIds})
          `;
          delegatedExpenseRows.push(...rows);
        }
      }
    }

    const delegatedExpenses = delegatedExpenseRows;
    const expenseById = new Map();
    [...expenses, ...delegatedExpenses].forEach((item) => {
      if (!item?.id) return;
      expenseById.set(item.id, item);
    });
    expenses = Array.from(expenseById.values()).sort((a, b) => {
      const leftDate = `${a?.expenseDate || ""}`;
      const rightDate = `${b?.expenseDate || ""}`;
      if (leftDate === rightDate) {
        return `${b?.createdAt || ""}`.localeCompare(`${a?.createdAt || ""}`);
      }
      return rightDate.localeCompare(leftDate);
    });
  }

  let users = [];
  if (normalizedUser) {
    const viewable = allUsers.filter((user) =>
      canCap("view_members", {
        resourceOfficeId: user.officeId ?? user.office_id ?? null,
        actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      })
    );
    if (viewable.length) {
      users = viewable.map((user) => {
        const canViewRates = canCap("view_member_rates", {
          resourceOfficeId: user.officeId ?? user.office_id ?? null,
          actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
        });
        const canEditRates = canCap("edit_member_rates", {
          resourceOfficeId: user.officeId ?? user.office_id ?? null,
          actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
        });
        const allowRates = canViewRates || canEditRates;
        return {
          ...user,
          baseRate: allowRates ? user.baseRate : null,
          costRate: allowRates ? user.costRate : null,
        };
      });
    } else {
      const self = allUsers.find((user) => user.id === normalizedUser.id);
      if (self) {
        users = [
          {
            ...self,
            baseRate: null,
            costRate: null,
          },
        ];
      }
    }
    if (delegatorUserIds.length) {
      const existing = new Set(users.map((item) => `${item?.id || ""}`.trim()).filter(Boolean));
      allUsers.forEach((user) => {
        const id = `${user?.id || ""}`.trim();
        if (!id || !delegatorUserIds.includes(id) || existing.has(id)) return;
        users.push({
          ...user,
          baseRate: null,
          costRate: null,
        });
        existing.add(id);
      });
    }
  }

  let actorProjectIds = [];
  if (normalizedUser) {
    const memberProjects = await listProjectMembersForUser(sql, normalizedUser.id, accountUuid);
    const managerAssignments = await listManagerAssignmentsForUser(sql, normalizedUser.id, accountUuid);
    actorProjectIds = [
      ...new Set([
        ...memberProjects.map((row) => row.projectId),
        ...(managerAssignments?.projectRows || []).map((row) => row.projectId),
      ]),
    ];
  }

  const projects = (await listProjects(sql, accountUuid)).filter((project) =>
    canCap("view_projects", {
      resourceOfficeId: project.officeId ?? project.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      projectId: project.id,
      actorProjectIds,
    })
  );
  // Expense categories are needed for expense entry even if the user cannot
  // manage categories in Settings. Always return active categories; the
  // Settings UI is still gated by settingsAccess.manageCategories.
  const expenseCategories = await listExpenseCategories(sql, accountUuid);
  const canUseDepartmentsForMembers =
    canCap("manage_departments", {
      resourceOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    }) ||
    canCap("edit_member_profile", {
      resourceOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    }) ||
    canCap("view_members", {
      resourceOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    });
  const departments = canUseDepartmentsForMembers
    ? await listDepartments(sql, accountUuid)
    : [];
  const canUseOfficeLocationsForMembers =
    canCap("manage_office_locations", {
      resourceOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    }) ||
    canCap("edit_member_profile", {
      resourceOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    }) ||
    canCap("create_member", {
      resourceOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
      actorOfficeId: normalizedUser?.officeId ?? normalizedUser?.office_id ?? null,
    });
  const officeLocations = canUseOfficeLocationsForMembers
    ? await listOfficeLocations(sql, accountUuid)
    : [];
  const assignments = {
    managerClients: [],
    managerProjects: [],
    projectMembers: [],
  };

  if (isAdminFlag) {
    assignments.managerClients = await listManagerClientAssignments(sql, accountUuid);
    assignments.managerProjects = await listManagerProjectAssignments(sql, accountUuid);
    assignments.projectMembers = await listProjectMembers(sql, accountUuid);
  } else if (isManagerFlag && normalizedUser) {
    const { clientRows, projectRows } = await listManagerAssignmentsForUser(
      sql,
      normalizedUser.id,
      accountUuid
    );
    assignments.managerClients = clientRows;
    assignments.managerProjects = projectRows;
    const scope = await getManagerScope(sql, normalizedUser.id, accountUuid);
    assignments.projectMembers = await listProjectMembersForProjects(
      sql,
      scope.projectIds,
      accountUuid
    );
  } else if (normalizedUser) {
    assignments.projectMembers = await listProjectMembersForUser(
      sql,
      normalizedUser.id,
      accountUuid
    );
  }

  if (delegatorUserIds.length) {
    const [delegatorMembers, delegatorManagerClients, delegatorManagerProjects] = await Promise.all([
      listProjectMembersForUsers(sql, delegatorUserIds, accountUuid),
      listManagerClientAssignmentsForManagers(sql, delegatorUserIds, accountUuid),
      listManagerProjectAssignmentsForManagers(sql, delegatorUserIds, accountUuid),
    ]);
    const memberKeys = new Set(
      assignments.projectMembers.map(
        (item) => `${item?.projectId || ""}:${item?.userId || ""}`
      )
    );
    delegatorMembers.forEach((item) => {
      const key = `${item?.projectId || ""}:${item?.userId || ""}`;
      if (!key || memberKeys.has(key)) return;
      memberKeys.add(key);
      assignments.projectMembers.push(item);
    });
    const managerClientKeys = new Set(
      assignments.managerClients.map(
        (item) => `${item?.managerId || ""}:${item?.clientId || ""}`
      )
    );
    delegatorManagerClients.forEach((item) => {
      const key = `${item?.managerId || ""}:${item?.clientId || ""}`;
      if (!key || managerClientKeys.has(key)) return;
      managerClientKeys.add(key);
      assignments.managerClients.push(item);
    });
    const managerProjectKeys = new Set(
      assignments.managerProjects.map(
        (item) => `${item?.managerId || ""}:${item?.projectId || ""}`
      )
    );
    delegatorManagerProjects.forEach((item) => {
      const key = `${item?.managerId || ""}:${item?.projectId || ""}`;
      if (!key || managerProjectKeys.has(key)) return;
      managerProjectKeys.add(key);
      assignments.managerProjects.push(item);
    });
  }

  const catalog = {};
  for (const row of catalogRows) {
    if (!catalog[row.client]) {
      catalog[row.client] = [];
    }
    if (row.project) {
      catalog[row.client].push(row.project);
    }
  }

  const inboxItems = normalizedUser
    ? await listInboxItems(sql, accountUuid, normalizedUser.id)
    : [];
  const notificationRules = await listNotificationRules(sql, accountUuid);
  const myDelegations = normalizedUser
    ? await listMyDelegations(sql, normalizedUser.id, accountUuid)
    : [];
  const delegationCandidates = normalizedUser
    ? await listDelegationCandidates(sql, normalizedUser.id, accountUuid)
    : [];

  return {
    bootstrapRequired: false,
    currentUser: normalizedUser
      ? {
          ...normalizedUser,
          permissionGroup: currentGroup,
          permission_group: currentGroup,
        }
      : null,
    settingsAccess: {
      settingsShell,
      viewMemberRates: viewMemberRatesCap,
      editMemberRates: editMemberRatesCap,
      manageCategories,
      manageLocations,
      editPermissionMatrix,
    },
    account: { id: accountUuid, name: accountRow?.name || null },
    users,
    clients,
    catalog,
    entries,
    expenses,
    projects,
    expenseCategories,
    departments,
    officeLocations,
    assignments,
    levelLabels,
    inboxItems,
    notificationRules,
    delegators,
    myDelegations,
    delegationCandidates,
  };
}

async function listAuditLogs(sql, accountId, filters = {}) {
  const clauses = [sql`account_id = ${accountId}::uuid`];
  if (filters.entityType) {
    clauses.push(sql`entity_type = ${filters.entityType}`);
  }
  if (filters.action) {
    clauses.push(sql`action = ${filters.action}`);
  }
  if (filters.actorId) {
    clauses.push(sql`changed_by_user_id = ${filters.actorId}`);
  }
  if (filters.fromDate) {
    clauses.push(sql`changed_at >= ${filters.fromDate}`);
  }
  if (filters.toDate) {
    clauses.push(sql`changed_at <= ${filters.toDate}`);
  }

  const offset = Number.isFinite(Number(filters.offset)) ? Math.max(0, Number(filters.offset)) : 0;
  const limit = Number.isFinite(Number(filters.limit))
    ? Math.max(1, Math.min(500, Number(filters.limit)))
    : 100;

  const where =
    clauses.length > 1
      ? clauses.reduce((acc, clause, idx) => (idx === 0 ? clause : sql`${acc} AND ${clause}`))
      : clauses[0];

  const rows = await sql`
    SELECT
      id,
      entity_type,
      entity_id,
      action,
      changed_by_user_id,
      changed_by_name_snapshot,
      target_user_id,
      context_client_id,
      context_project_id,
      changed_at,
      before_json,
      after_json,
      changed_fields_json
    FROM audit_log
    WHERE ${where}
    ORDER BY changed_at DESC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `;
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    rows: pageRows,
    hasMore,
    nextOffset: offset + pageRows.length,
  };
}

async function logAudit(
  sql,
  {
    accountId,
    entityType,
    entityId,
    action,
    changedByUserId,
    changedByNameSnapshot,
    targetUserId,
    contextClientId,
    contextProjectId,
    beforeJson,
    afterJson,
    changedFieldsJson,
  }
) {
  await sql`
    INSERT INTO audit_log (
      account_id,
      entity_type,
      entity_id,
      action,
      changed_by_user_id,
      changed_by_name_snapshot,
      target_user_id,
      context_client_id,
      context_project_id,
      before_json,
      after_json,
      changed_fields_json
    )
    VALUES (
      ${accountId}::uuid,
      ${entityType},
      ${entityId},
      ${action},
      ${changedByUserId},
      ${changedByNameSnapshot},
      ${targetUserId},
      ${contextClientId},
      ${contextProjectId},
      ${beforeJson ? JSON.stringify(beforeJson) : null}::jsonb,
      ${afterJson ? JSON.stringify(afterJson) : null}::jsonb,
      ${changedFieldsJson ? JSON.stringify(changedFieldsJson) : null}::jsonb
    )
  `;
}

module.exports = {
  clearSession,
  createSession,
  createUserRecord,
  createPasswordSetupToken,
  deactivateUser,
  ensureDefaultAccount,
  ensureSchema,
  ensureNotificationRulesForAccount,
  errorResponse,
  findClient,
  findProject,
  findUserByDisplayName,
  findUserById,
  findUserByUsername,
  getSessionContext,
  getSql,
  getManagerScope,
  json,
  listManagerAssignmentsForUser,
  listManagerClientAssignments,
  listManagerProjectAssignments,
  listProjectMembers,
  listProjectMembersForProjects,
  listProjectMembersForUser,
  listClients,
  listProjects,
  listExpenseCategories,
  listDepartments,
  listOfficeLocations,
  listInboxItems,
  listNotificationRules,
  listLevelLabels,
  listUsers,
  loadState,
  listAuditLogs,
  logAudit,
  normalizeLevel,
  normalizeText,
  parseBody,
  requireAdmin,
  requireSuperAdmin,
  requireAuth,
  updateUserPassword,
  updateUserRecord,
  verifyPassword,
  hashPassword,
  randomId,
};
