(function () {
  const deps = () => window.auditLogDeps || {};
  const ACTIVITY_ENTITIES = new Set(["time_entry", "expense"]);
  const CLIENT_PROJECT_ENTITIES = new Set([
    "client",
    "project",
    "project_member_assignment",
    "project_staffing",
    "client_lead",
    "project_lead",
  ]);
  const SETTINGS_ENTITIES = new Set([
    "level_label",
    "role_permission",
    "department",
    "office_location",
    "expense_category",
    "corporate_function_group",
    "corporate_function_category",
    "notification_rule",
    "delegation",
    "bulk_upload_config",
  ]);
  const AUDIT_FIELD_LABELS = {
    is_active: "Status",
    name: "Name",
    level: "Level",
    levels: "Levels",
    client_id: "Client",
    project_id: "Project",
    user_id: "Team Member",
    delegate_user_id: "Delegate",
    nonbillable: "Billable Status",
    delegated_action: "Delegated Action",
    delegated_by_user_id: "Delegate",
    category_id: "Category",
    date: "Date",
    hours: "Hours",
    amount: "Amount",
    notes: "Notes",
    status: "Status",
    permissions: "Permissions",
    categories: "Categories",
    offices: "Office Locations",
    groups: "Groups",
    capabilities: "Capabilities",
    id: "ID",
    client_name: "Client",
    project_lead_id: "Project Lead",
    office_lead_user_id: "Office Lead",
    role_key: "Role",
    capability_key: "Capability",
    scope_key: "Scope",
    allowed: "Allowed",
    event_type: "Event",
    email_enabled: "Email",
    inbox_enabled: "Inbox",
    enabled: "Enabled",
    delegator_user_id: "Delegator",
    group_name: "Group",
    permission_group: "Permission Group",
    sort_order: "Sort Order",
  };

  const AUDIT_ENTITY_LABELS = {
    time_entry: "Time Entry",
    expense: "Expense",
    client: "Client",
    project: "Project",
    level_label: "Member Level Labels",
    role_permission: "Member Access Levels",
    department: "Practice Department",
    office_location: "Office Location",
    expense_category: "Expense Category",
    corporate_function_group: "Corporate Function Group",
    corporate_function_category: "Corporate Function Category",
    notification_rule: "Messaging Rule",
    delegation: "Delegation",
    project_member_assignment: "Project Assignment",
    project_staffing: "Project Staffing",
    client_lead: "Client Lead",
    project_lead: "Project Lead",
  };

  function normalizeAuditValue(value) {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === "object" && v !== null) {
            return v.name || v.title || "";
          }
          return v;
        })
        .filter(Boolean)
        .join(", ");
    }

    if (typeof value === "object" && value !== null) {
      return value.name || value.title || "";
    }

    return value;
  }

  function formatAuditObject(value) {
    if (!value || typeof value !== "object") return "";
    if (value.name) return String(value.name);
    if (value.title) return String(value.title);
    if (value.level !== undefined || value.label || value.permission_group) {
      const level = value.level !== undefined ? `L${value.level}` : "Level";
      const label = value.label || "—";
      const group = value.permission_group ? ` (${value.permission_group})` : "";
      return `${level}: ${label}${group}`;
    }
    if (value.group_name && value.name) {
      return `${value.group_name} > ${value.name}`;
    }
    if (value.role_key && value.capability_key) {
      const scope = value.scope_key ? ` @ ${value.scope_key}` : "";
      const allowed = value.allowed === true ? "Allowed" : value.allowed === false ? "Denied" : "";
      return `${value.role_key} / ${value.capability_key}${scope}${allowed ? `: ${allowed}` : ""}`;
    }
    const primitives = Object.entries(value)
      .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
      .map(([k, v]) => `${AUDIT_FIELD_LABELS[k] || k.replace(/_/g, " ")}: ${v}`);
    return primitives.join(", ");
  }

  function normalizeAuditValueForField(field, value) {
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === "object" && v !== null) return formatAuditObject(v);
          return v;
        })
        .filter(Boolean)
        .join(", ");
    }
    if (typeof value === "object" && value !== null) {
      if (["levels", "categories", "offices", "groups", "permissions", "capabilities"].includes(field)) {
        return formatAuditObject(value);
      }
      return normalizeAuditValue(value);
    }
    return normalizeAuditValue(value);
  }

  function formatLevelEntry(value) {
    if (!value || typeof value !== "object") return "";
    const level = value.level !== undefined ? `L${value.level}` : "Level";
    const label = value.label || "—";
    const group = value.permission_group ? ` (${value.permission_group})` : "";
    return `${level}: ${label}${group}`;
  }

  function diffLevelsSide(currentLevels, otherLevels) {
    const currentMap = new Map(
      (Array.isArray(currentLevels) ? currentLevels : [])
        .filter((item) => item && typeof item === "object" && item.level !== undefined)
        .map((item) => [String(item.level), formatLevelEntry(item)])
    );
    const otherMap = new Map(
      (Array.isArray(otherLevels) ? otherLevels : [])
        .filter((item) => item && typeof item === "object" && item.level !== undefined)
        .map((item) => [String(item.level), formatLevelEntry(item)])
    );
    const changedLevels = Array.from(new Set([...currentMap.keys(), ...otherMap.keys()])).filter(
      (level) => currentMap.get(level) !== otherMap.get(level)
    );
    if (!changedLevels.length) return "";
    const sideValues = changedLevels
      .map((level) => currentMap.get(level))
      .filter(Boolean);
    return sideValues.length ? sideValues.join(", ") : "—";
  }

  function auditItemKey(item, index) {
    if (!item || typeof item !== "object") return `idx:${index}`;
    if (item.id !== undefined && item.id !== null && item.id !== "") return `id:${item.id}`;
    if (item.level !== undefined && item.level !== null) return `level:${item.level}`;
    if (item.name) return `name:${item.name}`;
    if (item.title) return `title:${item.title}`;
    if (item.role_key || item.capability_key || item.scope_key) {
      return `perm:${item.role_key || ""}|${item.capability_key || ""}|${item.scope_key || ""}`;
    }
    return `idx:${index}`;
  }

  function diffArraySide(currentArray, otherArray) {
    const current = Array.isArray(currentArray) ? currentArray : [];
    const other = Array.isArray(otherArray) ? otherArray : [];
    const objectish = current.some((v) => v && typeof v === "object") || other.some((v) => v && typeof v === "object");

    if (objectish) {
      const mapSide = (arr) =>
        new Map(
          arr.map((item, index) => {
            const key = auditItemKey(item, index);
            const text =
              typeof item === "object" && item !== null
                ? formatAuditObject(item)
                : formatAuditValue("", normalizeAuditValue(item));
            return [key, text];
          })
        );
      const currentMap = mapSide(current);
      const otherMap = mapSide(other);
      const changed = Array.from(currentMap.keys())
        .filter((key) => currentMap.get(key) !== otherMap.get(key))
        .map((key) => currentMap.get(key))
        .filter(Boolean);
      return changed.join(", ");
    }

    const count = (arr) => {
      const counts = new Map();
      for (const v of arr) {
        const token = String(v);
        counts.set(token, (counts.get(token) || 0) + 1);
      }
      return counts;
    };
    const curCounts = count(current);
    const otherCounts = count(other);
    const result = [];
    for (const [token, qty] of curCounts.entries()) {
      const delta = qty - (otherCounts.get(token) || 0);
      for (let i = 0; i < Math.max(0, delta); i += 1) result.push(token);
    }
    return result.join(", ");
  }

  function diffObjectSide(currentObject, otherObject) {
    if (!currentObject || typeof currentObject !== "object") return "";
    const current = currentObject;
    const other = otherObject && typeof otherObject === "object" ? otherObject : {};
    const keys = new Set([...Object.keys(current), ...Object.keys(other)]);
    const parts = [];
    for (const key of keys) {
      if (JSON.stringify(current[key]) === JSON.stringify(other[key])) continue;
      if (!(key in current)) continue;
      const label = AUDIT_FIELD_LABELS[key] || key.replace(/_/g, " ");
      const raw = normalizeAuditValueForField(key, current[key]);
      parts.push(`${label}: ${formatAuditValue(key, raw)}`);
    }
    return parts.join(", ");
  }

  function diffCompositeFieldSide(field, currentValue, otherValue) {
    if (Array.isArray(currentValue) && Array.isArray(otherValue)) {
      if (field === "levels") return diffLevelsSide(currentValue, otherValue);
      return diffArraySide(currentValue, otherValue);
    }
    if (
      currentValue &&
      otherValue &&
      typeof currentValue === "object" &&
      typeof otherValue === "object"
    ) {
      return diffObjectSide(currentValue, otherValue);
    }
    return "";
  }

  function formatAuditValue(field, value) {
    if (field === "is_active") {
      return value ? "Active" : "Inactive";
    }

    if (value === null || value === undefined || value === "") {
      return "—";
    }

    return String(value);
  }

  function formatEventType(value) {
    const raw = `${value || ""}`.trim();
    if (!raw) return "";
    return raw
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function isDeepEqual(a, b) {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (error) {
      return false;
    }
  }

  function deriveChangedKeysForUpdate(row) {
    const changed = Array.isArray(row?.changed_fields_json)
      ? row.changed_fields_json.filter((key) => typeof key === "string" && key.trim())
      : [];
    if (changed.length) {
      return Array.from(new Set(changed));
    }
    const before = row?.before_json && typeof row.before_json === "object" ? row.before_json : {};
    const after = row?.after_json && typeof row.after_json === "object" ? row.after_json : {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).filter((key) => !isDeepEqual(before[key], after[key]));
  }

  function auditCategoryForRow(row) {
    const entity = `${row?.entity_type || ""}`.trim().toLowerCase();
    if (ACTIVITY_ENTITIES.has(entity)) return "activity";
    if (CLIENT_PROJECT_ENTITIES.has(entity) || entity.includes("client") || entity.includes("project")) {
      return "client_project";
    }
    if (
      SETTINGS_ENTITIES.has(entity) ||
      entity.includes("setting") ||
      entity.includes("department") ||
      entity.includes("office") ||
      entity.includes("level") ||
      entity.includes("permission") ||
      entity.includes("category") ||
      entity.includes("delegation") ||
      entity.includes("messaging") ||
      entity.includes("corporate_function")
    ) {
      return "settings_edits";
    }
    return "activity";
  }

  function renderAuditTable(logs) {
    const { refs, state, escapeHtml, userNameById, projectNameById, clientNameById, formatDateTimeLocal } = deps();
    if (!refs.auditTableBody) return;
    const rows = Array.isArray(logs) ? logs : [];
    const todayIso = (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
    const toLocalIso = (value) => {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    // Store full-range dates for picker bounds using the full audit dataset, not the filtered subset.
    if (refs.auditTableBody) {
      const globalMin = toLocalIso(state?.auditDateBounds?.min || "");
      const globalMax = toLocalIso(state?.auditDateBounds?.max || "");
      if (globalMin && globalMax) {
        refs.auditTableBody.dataset.rangeMin = globalMin;
        refs.auditTableBody.dataset.rangeMax = globalMax > todayIso ? globalMax : todayIso;
      } else {
        const allDates = (state.auditLogs || [])
          .map((row) => toLocalIso(row.changed_at || row.changedAt || ""))
          .filter(Boolean)
          .sort();
        refs.auditTableBody.dataset.rangeMin = allDates[0] || "";
        const computedMax = allDates[allDates.length - 1] || "";
        refs.auditTableBody.dataset.rangeMax = computedMax
          ? computedMax > todayIso
            ? computedMax
            : todayIso
          : todayIso;
      }
    }

    if (!rows.length) {
      refs.auditTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-row">
            <div class="empty-state-panel">
              <strong>No audit log entries yet.</strong>
              <span>Actions will appear here once recorded.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    if (typeof deps().syncAuditFilterOptions === "function") {
      deps().syncAuditFilterOptions(rows);
    }

    refs.auditTableBody.innerHTML = rows
      .map((row) => {
        const friendlyEntity = humanizeEntity(row.entity_type);
        const friendlyAction = humanizeAction(row.action);
        const actor =
          row.changed_by_name_snapshot || userNameById(row.changed_by_user_id) || row.changed_by_user_id || "Unknown";
        const isBulkUploadAction = Boolean(
          row?.after_json?.bulkUpload || row?.before_json?.bulkUpload
        );
        const delegatedAction = Boolean(
          row?.after_json?.delegated_action || row?.before_json?.delegated_action
        );
        const actorId = `${row.changed_by_user_id || ""}`.trim();
        const targetId = `${row.target_user_id || ""}`.trim();
        const actedForOtherUser = Boolean(targetId) && actorId !== targetId;
        const ownerName = userNameById(row.target_user_id) || row.target_user_id || "";
        const actorDisplay = isBulkUploadAction
          ? `Bulk upload by ${actor}`
          : (delegatedAction || actedForOtherUser) && ownerName
            ? `${actor} (for ${ownerName})`
            : actor;
        const projectName = projectNameById(row.context_project_id) || "";
        const clientName = clientNameById(row.context_client_id, projectName ? row.context_project_id : null) || "";
        const changedKeysForUpdate = row.action === "update" ? deriveChangedKeysForUpdate(row) : [];
        const beforeLines = formatAuditKV(row.before_json, row.entity_type, row.action, "before", {
          clientName,
          projectName,
          includeKeys: row.action === "update" ? changedKeysForUpdate : undefined,
          compareJson: row.after_json,
        });
        const afterLines = formatAuditKV(row.after_json, row.entity_type, row.action, "after", {
          clientName,
          projectName,
          includeKeys: row.action === "update" ? changedKeysForUpdate : undefined,
          compareJson: row.before_json,
        });

        const summarySubject = summarizeAuditSubject(row, { clientName, projectName, userNameById, clientNameById, projectNameById });
        const summary = `${escapeHtml(actorDisplay)} ${friendlyAction.toLowerCase()} ${summarySubject || `a ${friendlyEntity}`}`;
        const changedFields =
          Array.isArray(row.changed_fields_json) && row.changed_fields_json.length
            ? row.changed_fields_json.map(humanizeField).join(", ")
            : "-";

        return `
          <tr>
            <td>${escapeHtml(formatDateTimeLocal(row.changed_at))}</td>
            <td>${escapeHtml(actorDisplay)}</td>
            <td>${escapeHtml(friendlyEntity)}</td>
            <td>${escapeHtml(friendlyAction)}</td>
            <td>${escapeHtml(changedFields)}</td>
            <td>
              <details>
                <summary>${summary}</summary>
                <div class="audit-detail">
                  <div class="audit-detail-col">
                    <strong>Before</strong>
                    ${
                      row.action === "update" && !changedKeysForUpdate.length
                        ? '<div class="audit-empty">No field-level changes captured</div>'
                        : beforeLines || '<div class="audit-empty">New record</div>'
                    }
                  </div>
                  <div class="audit-detail-col">
                    <strong>After</strong>
                    ${
                      row.action === "update" && !changedKeysForUpdate.length
                        ? '<div class="audit-empty">No field-level changes captured</div>'
                        : afterLines || '<div class="audit-empty">Deleted</div>'
                    }
                  </div>
                </div>
              </details>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function filterAuditLogs(logs) {
    const { state } = deps();
    let rows = Array.isArray(logs) ? logs : [];
    const { entity, action, actor, beginDate, endDate, category } = state.auditFilters || {};
    if (category) {
      rows = rows.filter((row) => auditCategoryForRow(row) === category);
    }
    if (entity) {
      rows = rows.filter((row) => row.entity_type === entity);
    }
    if (action) {
      rows = rows.filter((row) => row.action === action);
    }
    if (actor) {
      rows = rows.filter((row) => row.changed_by_user_id === actor);
    }
    if (beginDate || endDate) {
      rows = rows.filter((row) => {
        const changedAtIso = String(row.changed_at || row.changedAt || "").slice(0, 10);
        if (!changedAtIso) return false;
        if (beginDate && changedAtIso < beginDate) return false;
        if (endDate && changedAtIso > endDate) return false;
        return true;
      });
    }
    return rows;
  }

  const ENTITY_LABELS = AUDIT_ENTITY_LABELS;

  const ACTION_LABELS = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    approve: "Approved",
    unapprove: "Unapproved",
  };

  function humanizeEntity(entity) {
    if (!entity) return "";
    return ENTITY_LABELS[entity] || entity.replace(/_/g, " ");
  }

  function humanizeAction(action) {
    return ACTION_LABELS[action] || action || "";
  }

  function humanizeField(field) {
    if (!field) return "";
    return AUDIT_FIELD_LABELS[field] || field.replace(/_/g, " ");
  }

  function auditFieldLabel(field, entityType) {
    const entity = `${entityType || ""}`.trim().toLowerCase();
    if (field === "name" && entity === "project") return "Project";
    if (field === "name" && entity === "client") return "Client";
    return humanizeField(field);
  }

  function resolveAuditRawValue(key, value, contextNames) {
    const { userNameById, projectNameById, clientNameById, formatDisplayDate } = deps();
    const clientOverride = contextNames?.clientName;
    const projectOverride = contextNames?.projectName;
    if (key === "client_id" && clientOverride) return clientOverride;
    if (key === "project_id" && projectOverride) return projectOverride;
    if (key === "nonbillable") return value ? "Non-billable" : "Billable";
    if (key === "delegated_action") return value ? "Yes" : "No";
    if (key === "delegated_by_user_id") return userNameById(value) || value;
    if (key === "delegate_user_id") return userNameById(value) || value;
    if (key === "delegator_user_id") return userNameById(value) || value;
    if (key === "office_lead_user_id") return userNameById(value) || value;
    if (key === "project_lead_id") return userNameById(value) || value;
    if (key === "event_type") return formatEventType(value);
    if (key === "date") return formatDisplayDate(String(value || ""));
    if (key === "hours") return Number(value).toFixed(2);
    if (key === "amount") return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : value;
    if (key === "user_id") return userNameById(value) || value;
    if (key === "project_id") return projectNameById(value) || value;
    if (key === "client_id") return clientNameById(value) || value;
    return value;
  }

  function summarizeAuditSubject(row, names) {
    const entityLabel = humanizeEntity(row?.entity_type || "");
    const before = row?.before_json && typeof row.before_json === "object" ? row.before_json : {};
    const after = row?.after_json && typeof row.after_json === "object" ? row.after_json : {};
    const payload = Object.keys(after).length ? after : before;
    if (!payload || typeof payload !== "object") return `a ${entityLabel}`;

    const subjectName =
      payload.name ||
      payload.client_name ||
      (payload.project_id ? names.projectNameById(payload.project_id) : "") ||
      (payload.client_id ? names.clientNameById(payload.client_id) : "") ||
      (payload.user_id ? names.userNameById(payload.user_id) : "") ||
      (payload.delegate_user_id ? names.userNameById(payload.delegate_user_id) : "") ||
      "";

    if (!subjectName) return `a ${entityLabel}`;
    return `${entityLabel}: ${subjectName}`;
  }

  function formatAuditKV(json, entityType, action, position, contextNames) {
    const { escapeHtml } = deps();
    if (!json || typeof json !== "object" || !Object.keys(json).length) {
      if (action === "create" && position === "before") return "";
      if (action === "delete" && position === "after") return "";
      return "";
    }
    const clientOverride = contextNames?.clientName;
    const projectOverride = contextNames?.projectName;
    const includeKeys = Array.isArray(contextNames?.includeKeys) ? new Set(contextNames.includeKeys) : null;
    const compareJson =
      contextNames?.compareJson && typeof contextNames.compareJson === "object" ? contextNames.compareJson : null;
    return Object.entries(json)
      .filter(([key]) => !includeKeys || includeKeys.has(key))
      .map(([field, value]) => {
        if (field === "client_name" && Object.prototype.hasOwnProperty.call(json, "client_id")) {
          return "";
        }
        if (compareJson && JSON.stringify(value) === JSON.stringify(compareJson[field])) {
          return "";
        }
        const label = auditFieldLabel(field, entityType);
        const compositeDelta = compareJson
          ? diffCompositeFieldSide(field, value, compareJson[field])
          : "";
        if (compositeDelta) {
          return `<div class="audit-kv"><span class="audit-k">${escapeHtml(label)}</span><span class="audit-v">${escapeHtml(compositeDelta)}</span></div>`;
        }
        const rawValue = resolveAuditRawValue(field, value, {
          clientName: clientOverride,
          projectName: projectOverride,
        });
        const displayValue = formatAuditValue(field, normalizeAuditValueForField(field, rawValue));
        return `<div class="audit-kv"><span class="audit-k">${escapeHtml(label)}</span><span class="audit-v">${escapeHtml(displayValue)}</span></div>`;
      })
      .filter(Boolean)
      .join("");
  }

  function applyAuditFiltersFromForm() {
    const { parseDisplayDate, refs, state, loadAuditLogs } = deps();
    const beginRaw =
      refs.auditFilterBeginDate?.dataset?.dpCanonical ||
      refs.auditFilterBeginDate?.value ||
      "";
    const endRaw =
      refs.auditFilterEndDate?.dataset?.dpCanonical ||
      refs.auditFilterEndDate?.value ||
      "";
    const beginDate = parseDisplayDate(beginRaw) || beginRaw || "";
    const endDate = parseDisplayDate(endRaw) || endRaw || "";
    state.auditFilters = {
      category: refs.auditFilterCategory?.value || "",
      entity: refs.auditFilterEntity?.value || "",
      action: refs.auditFilterAction?.value || "",
      actor: refs.auditFilterActor?.value || "",
      beginDate: beginDate || "",
      endDate: endDate || "",
    };
    if (typeof loadAuditLogs === "function") {
      loadAuditLogs({ append: false });
      return;
    }
    renderAuditTable(filterAuditLogs(state.auditLogs));
  }

  window.auditLog = {
    renderAuditTable,
    filterAuditLogs,
    humanizeEntity,
    humanizeAction,
    humanizeField,
    auditCategoryForRow,
    formatAuditValue,
    formatAuditKV,
    applyAuditFiltersFromForm,
  };
})();
