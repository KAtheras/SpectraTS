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

  function updateRow(index, field, value, opts = {}) {
    const { render = true } = opts;
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
    if (render) {
      renderTable();
    }
  }

  function resetRows() {
    state.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
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
    const tableEl = r.body.closest("table");
    if (tableEl) {
      tableEl.style.borderCollapse = "collapse";
      tableEl.style.width = "100%";
      tableEl.style.tableLayout = "fixed";
      const existingColgroup = tableEl.querySelector("colgroup");
      if (existingColgroup) tableEl.removeChild(existingColgroup);
      const colgroup = document.createElement("colgroup");
      colgroup.innerHTML = `
        <col style="width: 120px;">
        <col style="width: 170px;">
        <col style="width: 190px;">
        <col style="width: 50px;">
        <col style="width: 60px;">
        <col style="width: auto;">
        <col style="width: 44px;">
      `;
      tableEl.insertBefore(colgroup, tableEl.firstChild);
    }

    r.body.innerHTML = state.rows
      .map((row, idx) => {
        const projects = projectOptions(row.client);
        const tdStyle = 'border:1px solid #d5d9e1; padding:0; height:34px; background:#fff;';
        const tdHoursStyle = tdStyle + ' width:50px; max-width:50px;';
        const tdBillableStyle = tdStyle + ' width:60px; max-width:60px;';
        const tdDeleteStyle = tdStyle + ' width:44px; max-width:44px;';
        const baseInputStyle = 'width:100%; height:100%; padding:6px 6px; border:none; border-radius:4px; background:transparent; box-shadow:none; outline:none; box-sizing:border-box; min-width:0; appearance:none; -webkit-appearance:none; -moz-appearance:textfield;';
        const inputStyle = baseInputStyle;
        const hoursInputStyle = baseInputStyle + ' text-align:right;';
        return `
          <tr class="bulk-entry-row" data-row="${idx}">
            <td class="bulk-entry-cell bulk-col-date" style="${tdStyle}"><input type="date" class="bulk-input" data-field="date" value="${row.date || ""}" style="${inputStyle}" /></td>
            <td class="bulk-entry-cell bulk-col-client" style="${tdStyle}">
              <select class="bulk-input" data-field="client" style="${inputStyle}">
                <option value=""></option>
                ${clients
                  .map((c) => `<option value="${escapeHtml(c)}"${c === row.client ? " selected" : ""}>${escapeHtml(c)}</option>`)
                  .join("")}
              </select>
            </td>
            <td class="bulk-entry-cell bulk-col-project" style="${tdStyle}">
              <select class="bulk-input" data-field="project" style="${inputStyle}">
                <option value=""></option>
                ${projects
                  .map((p) => `<option value="${escapeHtml(p)}"${p === row.project ? " selected" : ""}>${escapeHtml(p)}</option>`)
                  .join("")}
              </select>
            </td>
            <td class="bulk-entry-cell bulk-col-hours" style="${tdHoursStyle}"><input type="text" class="bulk-input" data-field="hours" value="${row.hours}" style="${hoursInputStyle}" /></td>
            <td class="bulk-entry-cell bulk-col-billable bulk-center" style="${tdBillableStyle} text-align:center;">
              <input type="checkbox" class="bulk-checkbox" data-field="billable" ${row.billable ? "checked" : ""} style="margin:0 auto; display:block; width:16px; height:16px; transform:scale(0.9);" />
            </td>
            <td class="bulk-entry-cell bulk-col-notes" style="${tdStyle}"><input type="text" class="bulk-input" data-field="notes" value="${escapeHtml(row.notes)}" style="${inputStyle}" /></td>
            <td class="bulk-entry-cell bulk-col-delete bulk-center" style="${tdDeleteStyle} text-align:center;">
              <button type="button" class="text-button danger bulk-delete" data-action="delete" aria-label="Delete row" style="border:none; background:transparent; padding:0; cursor:pointer; color:#b44; font-size:14px; line-height:1;">✕</button>
            </td>
          </tr>
        `;
      })
      .join("");

    if (tableEl) {
      tableEl.querySelectorAll("th").forEach((th) => {
        th.style.border = "1px solid #d5d9e1";
        th.style.padding = "6px 8px";
        th.style.height = "36px";
        th.style.background = "#f4f6fb";
        th.style.fontWeight = "600";
        th.style.textAlign = "left";
      });
    }

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
    const isLiveText =
      event.type === "input" && (field === "notes" || field === "hours");
    updateRow(index, field, value, { render: !isLiveText });
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
    getRows: () => state.rows.map((row) => ({ ...row })),
    resetRows,
  };
})();
