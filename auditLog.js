(function () {
  const deps = () => window.auditLogDeps || {};
  function renderAuditTable(logs) {
    const { refs, state, escapeHtml, userNameById, projectNameById, clientNameById, formatDateTimeLocal } = deps();
    if (!refs.auditTableBody) return;
    const rows = Array.isArray(logs) ? logs : [];

    // Store full-range dates for picker bounds using the full audit dataset, not the filtered subset.
    if (refs.auditTableBody) {
      const allDates = (state.auditLogs || [])
        .map((row) => (row.changed_at || row.changedAt || "").slice(0, 10))
        .filter(Boolean)
        .sort();
      refs.auditTableBody.dataset.rangeMin = allDates[0] || "";
      refs.auditTableBody.dataset.rangeMax = allDates[allDates.length - 1] || "";
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

    const actorOptions = [
      ...new Map(
        rows
          .filter((row) => row.changed_by_user_id)
          .map((row) => [row.changed_by_user_id, row.changed_by_name_snapshot || row.changed_by_user_id])
      ).entries(),
    ];
    if (refs.auditFilterActor && refs.auditFilterActor.options.length <= 1) {
      refs.auditFilterActor.innerHTML = [
        `<option value="">All</option>`,
        ...actorOptions.map(
          ([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`
        ),
      ].join("");
    }

    refs.auditTableBody.innerHTML = rows
      .map((row) => {
        const friendlyEntity = humanizeEntity(row.entity_type);
        const friendlyAction = humanizeAction(row.action);
        const actor =
          row.changed_by_name_snapshot || userNameById(row.changed_by_user_id) || row.changed_by_user_id || "Unknown";
        const projectName = projectNameById(row.context_project_id) || "";
        const clientName = clientNameById(row.context_client_id, projectName ? row.context_project_id : null) || "";
        const beforeLines = formatAuditKV(row.before_json, row.entity_type, row.action, "before", {
          clientName,
          projectName,
        });
        const afterLines = formatAuditKV(row.after_json, row.entity_type, row.action, "after", {
          clientName,
          projectName,
        });

        const summary = `${escapeHtml(actor)} ${friendlyAction.toLowerCase()} a ${friendlyEntity}`;
        const changedFields =
          Array.isArray(row.changed_fields_json) && row.changed_fields_json.length
            ? row.changed_fields_json.map(humanizeField).join(", ")
            : "-";

        return `
          <tr>
            <td>${escapeHtml(formatDateTimeLocal(row.changed_at))}</td>
            <td>${escapeHtml(actor)}</td>
            <td>${escapeHtml(friendlyEntity)}</td>
            <td>${escapeHtml(friendlyAction)}</td>
            <td>${escapeHtml(changedFields)}</td>
            <td>
              <details>
                <summary>${summary}</summary>
                <div class="audit-detail">
                  <div class="audit-detail-col">
                    <strong>Before</strong>
                    ${beforeLines || '<div class="audit-empty">New record</div>'}
                  </div>
                  <div class="audit-detail-col">
                    <strong>After</strong>
                    ${afterLines || '<div class="audit-empty">Deleted</div>'}
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
    const { entity, action, actor, date } = state.auditFilters || {};
    if (entity) {
      rows = rows.filter((row) => row.entity_type === entity);
    }
    if (action) {
      rows = rows.filter((row) => row.action === action);
    }
    if (actor) {
      rows = rows.filter((row) => row.changed_by_user_id === actor);
    }
    if (date) {
      rows = rows.filter((row) => {
        const changedAt = row.changed_at || row.changedAt || "";
        return changedAt.slice(0, 10) === date;
      });
    }
    return rows;
  }

  const FIELD_LABELS = {
    nonbillable: "Billable Status",
    user_id: "Team Member",
    client_id: "Client",
    project_id: "Project",
    category_id: "Category",
    date: "Date",
    hours: "Hours",
    amount: "Amount",
    notes: "Notes",
    status: "Status",
  };

  const ENTITY_LABELS = {
    time_entry: "Time Entry",
    expense: "Expense",
  };

  const ACTION_LABELS = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    approve: "Approved",
    unapprove: "Unapproved",
  };

  function humanizeEntity(entity) {
    return ENTITY_LABELS[entity] || entity || "";
  }

  function humanizeAction(action) {
    return ACTION_LABELS[action] || action || "";
  }

  function humanizeField(field) {
    if (!field) return "";
    return FIELD_LABELS[field] || field;
  }

  function formatValue(key, value) {
    const { escapeHtml, userNameById, projectNameById, clientNameById, formatDisplayDate } = deps();
    if (value === null || value === undefined || value === "") return "—";
    if (key === "nonbillable") return value ? "Non-billable" : "Billable";
    if (key === "date") return formatDisplayDate(String(value));
    if (key === "hours") return Number(value).toFixed(2);
    if (key === "amount") return `$${Number(value).toFixed(2)}`;
    if (key === "user_id") return escapeHtml(userNameById(value) || String(value));
    if (key === "project_id") return escapeHtml(projectNameById(value) || String(value));
    if (key === "client_id") return escapeHtml(clientNameById(value) || String(value));
    return escapeHtml(String(value));
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
    return Object.entries(json)
      .map(([key, value]) => {
        const label = humanizeField(key);
        const displayValue = (() => {
          if (key === "client_id" && clientOverride) return clientOverride;
          if (key === "project_id" && projectOverride) return projectOverride;
          return formatValue(key, value);
        })();
        return `<div class="audit-kv"><span class="audit-k">${escapeHtml(label)}</span><span class="audit-v">${escapeHtml(
          displayValue
        )}</span></div>`;
      })
      .join("");
  }

  function applyAuditFiltersFromForm() {
    const { parseDisplayDate, refs, state } = deps();
    const dateIso = parseDisplayDate(refs.auditFilterDate?.value) || refs.auditFilterDate?.value || "";
    state.auditFilters = {
      entity: refs.auditFilterEntity?.value || "",
      action: refs.auditFilterAction?.value || "",
      actor: refs.auditFilterActor?.value || "",
      date: dateIso || "",
    };
    if (refs.auditFilterDate) {
      refs.auditFilterDate.value = dateIso;
    }
    renderAuditTable(filterAuditLogs(state.auditLogs));
    loadAuditLogs();
  }

  window.auditLog = {
    renderAuditTable,
    filterAuditLogs,
    humanizeEntity,
    humanizeAction,
    humanizeField,
    formatValue,
    formatAuditKV,
    applyAuditFiltersFromForm,
  };
})();
