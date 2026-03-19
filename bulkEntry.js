(function () {
  const state = {
    rows: [],
    initialized: false,
  };

  const els = {};

  function refs() {
    return {
      body: document.getElementById("bulk-entry-body"),
      addRow: document.getElementById("bulk-add-row"),
    };
  }

  function deps() {
    return window.catalogEditorDeps || {};
  }

  function initBulkRows() {
    state.rows = [
      createEmptyRow(),
      createEmptyRow(),
      createEmptyRow(),
    ];
    renderTable();
  }

  function createEmptyRow() {
    const { today } = deps();
    return {
      date: today || "",
      client: "",
      project: "",
      hours: "",
      billable: true,
      notes: "",
    };
  }

  function addRow() {
    const last = state.rows[state.rows.length - 1] || createEmptyRow();
    state.rows.push({
      ...createEmptyRow(),
      date: last.date,
      client: last.client,
      project: last.project,
    });
    renderTable();
  }

  function deleteRow(index) {
    state.rows.splice(index, 1);
    if (!state.rows.length) {
      state.rows.push(createEmptyRow());
    }
    renderTable();
  }

  function updateRow(index, field, value) {
    const row = state.rows[index];
    if (!row) return;
    if (field === "billable") {
      row.billable = value;
    } else {
      row[field] = value;
    }
    if (field === "client") {
      row.project = "";
    }
    renderTable();
  }

  function clientOptions() {
    const { visibleCatalogClientNames } = deps();
    return typeof visibleCatalogClientNames === "function"
      ? visibleCatalogClientNames()
      : [];
  }

  function projectOptions(client) {
    const { visibleCatalogProjectNames } = deps();
    if (typeof visibleCatalogProjectNames !== "function") return [];
    return client ? visibleCatalogProjectNames(client) : [];
  }

  function renderTable() {
    const r = refs();
    if (!r.body) return;
    const clients = clientOptions();

    r.body.innerHTML = state.rows
      .map((row, idx) => {
        const projects = projectOptions(row.client);
        return `
          <tr data-row="${idx}">
            <td><input type="date" class="bulk-input" data-field="date" value="${row.date || ""}" /></td>
            <td>
              <select class="bulk-input" data-field="client">
                <option value=""></option>
                ${clients
                  .map((c) => `<option value="${escapeHtml(c)}"${c === row.client ? " selected" : ""}>${escapeHtml(c)}</option>`)
                  .join("")}
              </select>
            </td>
            <td>
              <select class="bulk-input" data-field="project">
                <option value=""></option>
                ${projects
                  .map((p) => `<option value="${escapeHtml(p)}"${p === row.project ? " selected" : ""}>${escapeHtml(p)}</option>`)
                  .join("")}
              </select>
            </td>
            <td><input type="number" class="bulk-input" data-field="hours" min="0" step="0.25" value="${row.hours}" /></td>
            <td class="bulk-center">
              <input type="checkbox" class="bulk-checkbox" data-field="billable" ${row.billable ? "checked" : ""} />
            </td>
            <td><input type="text" class="bulk-input" data-field="notes" value="${escapeHtml(row.notes)}" /></td>
            <td class="bulk-center">
              <button type="button" class="text-button danger bulk-delete" data-action="delete" aria-label="Delete row">Delete</button>
            </td>
          </tr>
        `;
      })
      .join("");

    wireRowEvents();
  }

  function wireRowEvents() {
    const r = refs();
    if (!r.body) return;
    r.body.querySelectorAll("input, select, button").forEach((el) => {
      if (el.dataset.field) {
        el.addEventListener("change", onFieldChange);
        el.addEventListener("input", onFieldChange);
      }
      if (el.dataset.action === "delete") {
        el.addEventListener("click", onDeleteRow);
      }
    });
  }

  function onFieldChange(event) {
    const rowEl = event.target.closest("tr[data-row]");
    if (!rowEl) return;
    const index = Number(rowEl.dataset.row);
    const field = event.target.dataset.field;
    let value = event.target.value;
    if (field === "billable") {
      value = event.target.checked;
    }
    updateRow(index, field, value);
  }

  function onDeleteRow(event) {
    const rowEl = event.target.closest("tr[data-row]");
    if (!rowEl) return;
    const index = Number(rowEl.dataset.row);
    deleteRow(index);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function init() {
    if (state.initialized) {
      renderTable();
      return;
    }
    state.initialized = true;
    const r = refs();
    if (r.addRow) {
      r.addRow.addEventListener("click", addRow);
    }
    initBulkRows();
  }

  window.bulkEntry = {
    init,
  };
})();
