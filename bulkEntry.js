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

  function isNonBillableDefault(projectName) {
    return /administrative|admin|internal/i.test(projectName || "");
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
    if (field === "project") {
      row.billable = !isNonBillableDefault(value);
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
        <col style="width: 70px;">
        <col style="width: 70px;">
        <col style="width: auto;">
      `;
      tableEl.insertBefore(colgroup, tableEl.firstChild);
      const headerRow = tableEl.querySelector("thead tr");
      if (headerRow && headerRow.children.length > 6) {
        while (headerRow.children.length > 6) {
          headerRow.lastElementChild.remove();
        }
      }
    }

    r.body.innerHTML = state.rows
      .map((row, idx) => {
        const projects = projectOptions(row.client);
        const tdStyle = 'border:1px solid var(--line); padding:0; height:34px; background:var(--surface); color:var(--ink);';
        const tdHoursStyle = tdStyle + ' width:50px; max-width:50px;';
        const tdBillableStyle = tdStyle + ' width:60px; max-width:60px;';
        const baseInputStyle = 'width:100%; height:100%; padding:6px 6px; border:none; border-radius:4px; background:transparent; box-shadow:none; outline:none; box-sizing:border-box; min-width:0; appearance:none; -webkit-appearance:none; -moz-appearance:textfield; color:var(--ink);';
        const inputStyle = baseInputStyle;
        const hoursInputStyle = baseInputStyle + ' text-align:right;';
        return `
          <tr class="bulk-entry-row" data-row="${idx}">
            <td class="bulk-entry-cell bulk-col-date" style="${tdStyle}"><input type="date" class="bulk-input bulk-date-input" data-field="date" value="${row.date || ""}" style="${inputStyle}" /></td>
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
          </tr>
        `;
      })
      .join("");

    // Apply the same date bounds as the main entry date input (for picker disabled days).
    const masterDate = document.getElementById("entry-date");
    const bulkDates = r.body.querySelectorAll('input[type="date"], .bulk-date-input');
    if (bulkDates.length) {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const masterMin = masterDate?.min || `${now.getFullYear() - 1}-01-01`;
      const masterMax = masterDate?.max || todayIso;
      const clamp = (val) => {
        if (masterMax && val && val > masterMax) return masterMax;
        if (masterMin && val && val < masterMin) return masterMin;
        return val || masterMax || todayIso;
      };
      bulkDates.forEach((input) => {
        if (masterMin) input.min = masterMin;
        input.max = masterMax;
        input.setAttribute("min", masterMin);
        input.setAttribute("max", masterMax);
        const clamped = clamp(input.value || "");
        input.value = clamped;
        input.dataset.dpCanonical = clamped;
        // Clamp on native change (in case picker not attached).
        input.addEventListener("change", () => {
          const v = clamp(input.value);
          input.value = v;
          input.dataset.dpCanonical = v;
        });
      });
    }

    if (tableEl) {
      tableEl.querySelectorAll("th").forEach((th) => {
        th.style.border = "1px solid var(--line)";
        th.style.padding = "6px 8px";
        th.style.height = "36px";
        th.style.background = "var(--surface-subtle)";
        th.style.fontWeight = "600";
        th.style.textAlign = "left";
        th.style.color = "var(--ink)";
      });
    }

    const container = r.body.closest(".bulk-entry-container");
    if (window.datePicker && typeof window.datePicker.registerAll === "function") {
      window.datePicker.registerAll(container);
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

// Expense bulk entry (separate state to avoid impacting timesheet).
(() => {
  const state = {
    rows: [],
    initialized: false,
  };

  function refs() {
    return {
      body: document.getElementById("expense-bulk-body"),
      addRow: document.getElementById("expense-bulk-add-row"),
      container: document.getElementById("expense-bulk-container"),
    };
  }

  function deps() {
    return window.catalogEditorDeps || {};
  }

  function createEmptyRow() {
    const { today } = deps();
    return {
      date: today || "",
      client: "",
      project: "",
      category: "",
      amount: "",
      billable: true,
      notes: "",
    };
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

  function categoryOptions() {
    const cats =
      (window.expenses && window.expenses.activeExpenseCategories?.()) || [];
    return Array.isArray(cats) ? cats : [];
  }

  function addRow() {
    const last = state.rows[state.rows.length - 1] || createEmptyRow();
    state.rows.push({
      ...createEmptyRow(),
      date: last.date,
      client: last.client,
      project: last.project,
      category: last.category,
    });
    renderTable();
  }

  function deleteRow(index) {
    state.rows.splice(index, 1);
    if (!state.rows.length) state.rows.push(createEmptyRow());
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
    if (field === "client") row.project = "";
    if (render) renderTable();
  }

  function renderTable() {
    const r = refs();
    if (!r.body) return;
    const clients = clientOptions();
    const cats = categoryOptions();
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
        <col style="width: 140px;">
        <col style="width: 90px;">
        <col style="width: 70px;">
        <col style="width: auto;">
      `;
      tableEl.insertBefore(colgroup, tableEl.firstChild);
    }

    r.body.innerHTML = state.rows
      .map((row, idx) => {
        const projects = projectOptions(row.client);
        const tdStyle =
          'border:1px solid var(--line); padding:0; height:34px; background:var(--surface); color:var(--ink);';
        const tdAmtStyle = tdStyle + " width:90px; max-width:90px;";
        const tdBillableStyle = tdStyle + " width:60px; max-width:60px;";
        const baseInputStyle =
          "width:100%; height:100%; padding:6px 6px; border:none; border-radius:4px; background:transparent; box-shadow:none; outline:none; box-sizing:border-box; min-width:0; appearance:none; -webkit-appearance:none; -moz-appearance:textfield; color:var(--ink);";
        const inputStyle = baseInputStyle;
        const amtInputStyle = baseInputStyle + " text-align:right;";
        return `
          <tr class="bulk-entry-row" data-row="${idx}">
            <td class="bulk-entry-cell bulk-col-date" style="${tdStyle}"><input type="date" class="bulk-input bulk-date-input bulk-expense-date" data-field="date" value="${row.date || ""}" style="${inputStyle}" /></td>
            <td class="bulk-entry-cell bulk-col-client" style="${tdStyle}">
              <select class="bulk-input" data-field="client" style="${inputStyle}">
                <option value=""></option>
                ${clients
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c)}"${
                        c === row.client ? " selected" : ""
                      }>${escapeHtml(c)}</option>`
                  )
                  .join("")}
              </select>
            </td>
            <td class="bulk-entry-cell bulk-col-project" style="${tdStyle}">
              <select class="bulk-input" data-field="project" style="${inputStyle}">
                <option value=""></option>
                ${projects
                  .map(
                    (p) =>
                      `<option value="${escapeHtml(p)}"${
                        p === row.project ? " selected" : ""
                      }>${escapeHtml(p)}</option>`
                  )
                  .join("")}
              </select>
            </td>
            <td class="bulk-entry-cell bulk-col-category" style="${tdStyle}">
              <select class="bulk-input" data-field="category" style="${inputStyle}">
                <option value=""></option>
                ${cats
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c)}"${
                        c === row.category ? " selected" : ""
                      }>${escapeHtml(c)}</option>`
                  )
                  .join("")}
              </select>
            </td>
            <td class="bulk-entry-cell bulk-col-amount" style="${tdAmtStyle}"><input type="number" class="bulk-input" data-field="amount" min="0" step="0.01" value="${row.amount}" style="${amtInputStyle}" /></td>
            <td class="bulk-entry-cell bulk-col-billable bulk-center" style="${tdBillableStyle} text-align:center;">
              <input type="checkbox" class="bulk-checkbox" data-field="billable" ${row.billable ? "checked" : ""} style="margin:0 auto; display:block; width:16px; height:16px; transform:scale(0.9);" />
            </td>
            <td class="bulk-entry-cell bulk-col-notes" style="${tdStyle}"><input type="text" class="bulk-input" data-field="notes" value="${escapeHtml(row.notes)}" style="${inputStyle}" /></td>
          </tr>
        `;
      })
      .join("");

    // Date bounds from main expense date input if present; else cap at today, min Jan 1 last year.
    const masterDate = document.getElementById("expense-date");
    const bulkDates = r.body.querySelectorAll(".bulk-expense-date");
    if (bulkDates.length) {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const masterMin = masterDate?.min || `${now.getFullYear() - 1}-01-01`;
      const masterMax = masterDate?.max || todayIso;
      bulkDates.forEach((input) => {
        input.min = masterMin;
        input.max = masterMax;
        const clampVal = (val) => {
          if (val && val > masterMax) return masterMax;
          if (val && val < masterMin) return masterMin;
          return val || masterMax;
        };
        const clamped = clampVal(input.value);
        input.value = clamped;
        input.dataset.dpCanonical = clamped;
        input.addEventListener("change", () => {
          const v = clampVal(input.value);
          input.value = v;
          input.dataset.dpCanonical = v;
        });
      });
    }

    if (tableEl) {
      tableEl.querySelectorAll("th").forEach((th) => {
        th.style.border = "1px solid var(--line)";
        th.style.padding = "6px 8px";
        th.style.height = "36px";
        th.style.background = "var(--surface-subtle)";
        th.style.fontWeight = "600";
        th.style.textAlign = "left";
        th.style.color = "var(--ink)";
      });
    }

    const container = r.body.closest(".bulk-entry-container");
    if (window.datePicker && typeof window.datePicker.registerAll === "function") {
      window.datePicker.registerAll(container);
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
    updateRow(index, field, value, { render: true });
  }

  function initBulkRows() {
    state.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
    renderTable();
  }

  function init() {
    if (state.initialized) {
      renderTable();
      return;
    }
    state.initialized = true;
    const r = refs();
    if (r.addRow) r.addRow.addEventListener("click", addRow);
    initBulkRows();
  }

  window.bulkExpenses = {
    init,
    getRows: () => state.rows.map((row) => ({ ...row })),
    resetRows: () => {
      state.rows = [createEmptyRow(), createEmptyRow(), createEmptyRow()];
      renderTable();
    },
  };

  // Auto-init when the container already exists (entryForm builds it before this script loads).
  const expenseContainer = document.getElementById("expense-bulk-container");
  if (expenseContainer) {
    init();
  }
})();
