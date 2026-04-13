"use strict";

const fs = require("fs");
const { execSync } = require("child_process");

const ROLE_ORDER = {
  staff: 1,
  manager: 2,
  executive: 3,
  admin: 4,
  superuser: 5,
};
const SUPERUSER_MATRIX_CONTROLLED_CAPABILITIES = new Set([
  "view_all_entries",
  "view_office_entries",
  "view_assigned_project_entries",
  "see_all_clients_projects",
  "see_office_clients_projects",
  "see_assigned_clients_projects",
  "manage_clients_lifecycle",
  "manage_projects_lifecycle",
  "edit_clients",
  "edit_projects_all_modal",
  "edit_project_planning",
]);

const HEADERS = {
  A: "category",
  B: "capability_key",
  C: "capability_label",
  D: "role_key",
  E: "scope_key",
  F: "allowed",
  G: "condition_key",
  H: "subject_rule",
  I: "ui_notes",
  J: "implementation_notes",
};

function parseSheetXml(xml) {
  const rowRe = /<row[^>]*?r="([0-9]+)"[^>]*>([\s\S]*?)<\/row>/g;
  const cellRe = /<c[^>]*?r="([A-Z]+)[0-9]+"[^>]*?>([\s\S]*?)<\/c>/g;
  const records = [];

  let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const rowIndex = Number(rowMatch[1]);
    if (rowIndex === 1) continue; // header row
    const rowXml = rowMatch[2];
    const rowValues = { row: rowIndex };
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowXml))) {
      const col = cellMatch[1];
      const body = cellMatch[2];
      const tMatch = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      const vMatch = body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      const raw = tMatch ? tMatch[1] : vMatch ? vMatch[1] : "";
      rowValues[col] = typeof raw === "string" ? raw.trim() : raw;
    }
    const rec = {};
    for (const [col, key] of Object.entries(HEADERS)) {
      const value = rowValues[col] || "";
      rec[key] = typeof value === "string" ? value.trim() : value;
    }
    if (Object.values(rec).every((v) => v === "")) continue;
    rec.allowed = rec.allowed === "1" || rec.allowed === 1 || rec.allowed === true;
    records.push(rec);
  }
  return records;
}

function parseWorkbook(filePath) {
  const path = require("path");
  const candidates = filePath
    ? [path.resolve(filePath)]
    : [
        path.resolve(__dirname, "..", "..", "final_permission_spec_clean.xlsx"),
        path.resolve(process.cwd(), "final_permission_spec_clean.xlsx"),
      ];
  const resolved = candidates.find((p) => fs.existsSync(p));
  if (!resolved) {
    throw new Error("final_permission_spec_clean.xlsx not found.");
  }
  const xml = execSync(`unzip -p ${resolved} xl/worksheets/sheet1.xml`, {
    encoding: "utf8",
  });
  return parseSheetXml(xml);
}

function mapSubjectRule(rule) {
  if (!rule) return { subject_role_max: null, allow_self: false };
  const normalized = rule.trim().toLowerCase();
  if (normalized === "target_role=staff") {
    return { subject_role_max: "staff", allow_self: false };
  }
  if (normalized === "target_role in (staff, manager) or actor_is_target=true") {
    return { subject_role_max: "manager", allow_self: true };
  }
  if (normalized === "any_role_in_scope" || normalized === "any_role") {
    return { subject_role_max: null, allow_self: true };
  }
  return { subject_role_max: null, allow_self: false };
}

function mapConditionKey(condition) {
  if (!condition) return null;
  const normalized = condition.trim().toLowerCase();
  if (normalized === "status=unapproved and actor_is_owner=true") {
    return "own_unapproved_only";
  }
  if (normalized === "status=approved") {
    return "approved_override";
  }
  return normalized;
}

function buildStructures(records) {
  const roles = new Map();
  const scopes = new Map();
  const capabilities = new Map();
  const permissions = [];

  for (const rec of records) {
    if (rec.role_key && !roles.has(rec.role_key)) {
      roles.set(rec.role_key, {
        key: rec.role_key,
        label: rec.role_key,
        is_global: rec.role_key === "superuser",
        is_active: true,
      });
    }
    if (rec.scope_key && !scopes.has(rec.scope_key)) {
      scopes.set(rec.scope_key, {
        key: rec.scope_key,
        label: rec.scope_key,
        is_active: true,
      });
    }
    if (rec.capability_key && !capabilities.has(rec.capability_key)) {
      capabilities.set(rec.capability_key, {
        key: rec.capability_key,
        label: rec.capability_label || rec.capability_key,
        category: rec.category || "",
        is_active: true,
      });
    }
    if (rec.allowed) {
      const subjectRule = mapSubjectRule(rec.subject_rule);
      const policyKey = mapConditionKey(rec.condition_key);
      permissions.push({
        role_key: rec.role_key,
        capability_key: rec.capability_key,
        scope_key: rec.scope_key,
        allowed: true,
        subject_role_max: subjectRule.subject_role_max,
        allow_self: subjectRule.allow_self,
        policy_key: policyKey,
      });
    }
  }

  return {
    roles: Array.from(roles.values()),
    scopes: Array.from(scopes.values()),
    capabilities: Array.from(capabilities.values()),
    permissions,
  };
}

function buildIndex(structs) {
  const byRole = new Map();
  for (const perm of structs.permissions) {
    if (!byRole.has(perm.role_key)) byRole.set(perm.role_key, new Map());
    const capMap = byRole.get(perm.role_key);
    if (!capMap.has(perm.capability_key)) capMap.set(perm.capability_key, []);
    capMap.get(perm.capability_key).push(perm);
  }
  return byRole;
}

function roleKeyFromUser(user) {
  if (!user) return null;
  const rawRole =
    user.permission_role_key ||
    user.role ||
    user.permissionGroup ||
    user.permission_group ||
    user.permissionRoleKey ||
    null;
  const raw = rawRole;
  if (!raw) return null;
  const value = String(raw).toLowerCase();
  if (value === "global_admin") return "superuser";
  return value;
}

function scopeMatches(scopeKey, ctx) {
  if (scopeKey === "all_offices") return true;
  if (scopeKey === "own_office") {
    const targetOffice = ctx.resourceOfficeId || ctx.targetOfficeId || null;
    // For shell/global actions with no specific target, allow as long as actor has an office.
    if (!targetOffice && !ctx.targetUserId && !ctx.targetRoleKey) {
      return Boolean(ctx.actorOfficeId);
    }
    return ctx.actorOfficeId && targetOffice && ctx.actorOfficeId === targetOffice;
  }
  if (scopeKey === "assigned_projects") {
    if (!ctx.projectId) return false;
    const assigned = ctx.actorProjectIds || [];
    return assigned.includes(ctx.projectId);
  }
  if (scopeKey === "own_records") {
    return Boolean(ctx.actorIsOwner);
  }
  return false;
}

function policySatisfied(policyKey, ctx) {
  if (!policyKey) return true;
  if (policyKey === "own_unapproved_only") {
    return ctx.actorIsOwner && ctx.recordStatus && ctx.recordStatus !== "approved";
  }
  if (policyKey === "approved_override") {
    return ctx.recordStatus === "approved";
  }
  return true;
}

function subjectRuleSatisfied(subjectRoleMax, allowSelf, ctx) {
  const targetRole = ctx.targetRoleKey || ctx.target_role_key;
  if (!targetRole && !subjectRoleMax) return true;
  if (allowSelf && ctx.actorUserId && ctx.targetUserId && ctx.actorUserId === ctx.targetUserId) {
    return true;
  }
  if (!subjectRoleMax) return true;
  const maxRank = ROLE_ORDER[subjectRoleMax];
  const targetRank = ROLE_ORDER[targetRole];
  if (!maxRank || !targetRank) return false;
  return targetRank <= maxRank;
}

function can(user, capabilityKey, ctx, permissionIndex) {
  if (
    roleKeyFromUser(user) === "superuser" &&
    !SUPERUSER_MATRIX_CONTROLLED_CAPABILITIES.has(`${capabilityKey || ""}`.trim())
  ) {
    return true;
  }
  const baseCtx = ctx || {};
  const normalizedCtx = {
    actorOfficeId: baseCtx.actorOfficeId ?? user?.office_id ?? user?.officeId,
    actorUserId: baseCtx.actorUserId ?? user?.id,
    ...baseCtx,
  };

  const index = permissionIndex || normalizedCtx.permissionIndex;
  if (!index) return false;
  const roleKey = roleKeyFromUser(user);
  if (!roleKey) return false;
  const roleCaps = index.get(roleKey);
  if (!roleCaps) return false;
  const perms = roleCaps.get(capabilityKey) || [];
  for (const perm of perms) {
    if (!perm.allowed) continue;
    if (!scopeMatches(perm.scope_key, normalizedCtx)) continue;
    if (!policySatisfied(perm.policy_key, normalizedCtx)) continue;
    if (!subjectRuleSatisfied(perm.subject_role_max, perm.allow_self, normalizedCtx)) continue;
    return true;
  }
  return false;
}

// Lightweight evaluator for client-side use when `window.permissionData` is available.
// Does not replace the primary `can` function above.
const canFromWindow = function can(user, capability, context = {}) {
  if (!user || !capability) return false;

  const role = user.role || user.permissionGroup;
  if (!role) return false;

  const permissionData =
    (typeof window !== "undefined" && window.permissionData) || {};
  const rolePermissions = permissionData.rolePermissions || [];

  const match = rolePermissions.find(
    (p) => p.role === role && p.capability === capability
  );

  if (!match) return false;

  const scope = match.scope;

  if (scope === "global") return true;

  if (scope === "self") {
    return context.targetUser && context.targetUser.id === user.id;
  }

  if (scope === "office") {
    return (
      context.targetUser &&
      user.officeId &&
      context.targetUser.officeId === user.officeId
    );
  }

  return false;
};

function loadPermissionsFromDb(sql) {
  return sql`
    SELECT
      pr.key AS role_key,
      pc.key AS capability_key,
      ps.key AS scope_key,
      rp.allowed,
      rp.subject_role_max,
      rp.allow_self,
      rp.policy_key
    FROM role_permissions rp
    JOIN permission_roles pr ON pr.id = rp.role_id AND pr.is_active = TRUE
    JOIN permission_capabilities pc ON pc.id = rp.capability_id AND pc.is_active = TRUE
    JOIN permission_scopes ps ON ps.id = rp.scope_id AND ps.is_active = TRUE
  `;
}

module.exports = {
  parseWorkbook,
  buildStructures,
  buildIndex,
  roleKeyFromUser,
  scopeMatches,
  policySatisfied,
  subjectRuleSatisfied,
  can,
  canFromWindow,
  loadPermissionsFromDb,
};
