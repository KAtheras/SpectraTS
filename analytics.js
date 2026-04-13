(function () {
  const stateByContainer = new WeakMap();

  function ensureStyles() {
    if (document.getElementById("analytics-phase1-style")) return;
    const style = document.createElement("style");
    style.id = "analytics-phase1-style";
    style.textContent = `
      .analytics-panel { display: grid; gap: 12px; }
      .analytics-filters { display: grid; grid-template-columns: repeat(6, minmax(140px, 1fr)); gap: 8px; }
      .analytics-filters label { display: grid; gap: 4px; font-size: .8rem; color: var(--muted); }
      .analytics-filters select, .analytics-filters input { min-height: 34px; }
      .analytics-kpis { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 8px; }
      .analytics-kpi { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: var(--surface); }
      .analytics-kpi-label { font-size: .76rem; color: var(--muted); margin-bottom: 4px; }
      .analytics-kpi-value { font-size: 1.05rem; font-weight: 600; }
      .analytics-chart-wrap { border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: var(--surface); }
      .analytics-chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .analytics-chart-empty { color: var(--muted); font-size: .9rem; padding: 14px 0; }
      .analytics-table-wrap { border: 1px solid var(--line); border-radius: 10px; overflow: auto; background: var(--surface); }
      .analytics-table-wrap table { width: 100%; min-width: 760px; border-collapse: collapse; }
      .analytics-table-wrap th, .analytics-table-wrap td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; }
      .analytics-table-wrap td.num, .analytics-table-wrap th.num { text-align: right; }
      .analytics-footnote { color: var(--muted); font-size: .76rem; }
    `;
    document.head.appendChild(style);
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function formatMoney(value) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      toNumber(value)
    );
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    return `${toNumber(value).toFixed(1)}%`;
  }

  function formatHours(value) {
    const n = toNumber(value);
    return `${n.toFixed(1)}h`;
  }

  function monthLabel(isoMonthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoMonthDate || "")) return "";
    const [year, month] = isoMonthDate.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
  }

  function dateBoundsFromData(dataState) {
    let minDate = "";
    let maxDate = "";
    const inspect = (date) => {
      const d = safeText(date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    };
    (dataState.entries || []).forEach((entry) => inspect(entry?.date));
    (dataState.expenses || []).forEach((expense) => inspect(expense?.expenseDate || expense?.expense_date || expense?.date));
    return {
      minDate,
      maxDate,
    };
  }

  function initialUiState(dataState) {
    const bounds = dateBoundsFromData(dataState);
    return {
      fromDate: bounds.minDate || "",
      toDate: bounds.maxDate || "",
      scope: "company",
      scopeId: "",
      clientId: "",
      projectId: "",
      trendMetric: "revenue",
      groupBy: "client",
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderOptions(items, selectedValue, placeholder) {
    const options = [];
    if (placeholder !== undefined) {
      options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    }
    (items || []).forEach((item) => {
      const value = safeText(item?.id ?? item?.value);
      const label = safeText(item?.name ?? item?.label);
      if (!value || !label) return;
      options.push(`<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`);
    });
    return options.join("");
  }

  function buildTrendSvg(trend, metric) {
    const values = (trend || []).map((item) => toNumber(item?.[metric]));
    if (!values.length) {
      return '<div class="analytics-chart-empty">No data in current filter range.</div>';
    }

    const width = 920;
    const height = 240;
    const padX = 34;
    const padY = 20;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = Math.max(max - min, 1);

    const points = values.map((value, index) => {
      const x = padX + ((values.length === 1 ? 0.5 : index / (values.length - 1)) * innerW);
      const y = padY + ((max - value) / range) * innerH;
      return { x, y, value, label: monthLabel(trend[index]?.month) };
    });

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");

    const baselineY = padY + ((max - 0) / range) * innerH;
    const ticks = [max, max - range / 2, min];

    const xLabels = points
      .map((point) => {
        const label = point.label;
        if (!label) return "";
        return `<text x="${point.x.toFixed(2)}" y="${height - 2}" text-anchor="middle" font-size="11" fill="var(--muted)">${escapeHtml(label)}</text>`;
      })
      .join("");

    const yGrid = ticks
      .map((value) => {
        const y = padY + ((max - value) / range) * innerH;
        return `<g>
          <line x1="${padX}" y1="${y.toFixed(2)}" x2="${width - padX}" y2="${y.toFixed(2)}" stroke="var(--line)" stroke-dasharray="4 3" />
          <text x="${padX - 6}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-size="11" fill="var(--muted)">${escapeHtml(formatMoney(value))}</text>
        </g>`;
      })
      .join("");

    const circles = points
      .map(
        (point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="var(--accent)" />`
      )
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="250" role="img" aria-label="Trend chart">
        ${yGrid}
        <line x1="${padX}" y1="${baselineY.toFixed(2)}" x2="${width - padX}" y2="${baselineY.toFixed(2)}" stroke="var(--line)" />
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${circles}
        ${xLabels}
      </svg>
    `;
  }

  function renderAnalyticsPage(options) {
    ensureStyles();

    const container = options?.container;
    const appState = options?.state || {};
    const engine = window.analyticsEngine;

    if (!container || !engine || typeof engine.computeAnalytics !== "function") {
      return;
    }

    const body = container.querySelector(".analytics-body") || container;
    let uiState = stateByContainer.get(container);
    if (!uiState) {
      uiState = initialUiState(appState);
      stateByContainer.set(container, uiState);
    }

    const scopeOptions = engine.listScopeOptions({
      offices: appState.officeLocations,
      departments: appState.departments,
    });
    const clientProjectOptions = engine.listClientProjectOptions({
      clients: appState.clients,
      projects: appState.projects,
    });

    const selectedClientId = uiState.clientId;
    const projectItems = selectedClientId
      ? clientProjectOptions.projectsByClient.get(selectedClientId) || []
      : [];

    const computed = engine.computeAnalytics({
      entries: appState.entries,
      expenses: appState.expenses,
      users: appState.users,
      projects: appState.projects,
      clients: appState.clients,
      offices: appState.officeLocations,
      departments: appState.departments,
      assignments: appState.assignments,
      levelLabels: appState.levelLabels,
      filters: {
        fromDate: uiState.fromDate,
        toDate: uiState.toDate,
        scope: uiState.scope,
        scopeId: uiState.scopeId,
        clientId: uiState.clientId,
        projectId: uiState.projectId,
        groupBy: uiState.groupBy,
      },
    });

    const metricLabelMap = {
      revenue: "Revenue",
      cost: "Cost",
      profit: "Profit",
    };

    const scopeItems =
      uiState.scope === "office"
        ? scopeOptions.offices
        : uiState.scope === "department"
        ? scopeOptions.departments
        : [];

    const groupedRowsHtml = (computed.groupedRows || [])
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.name)}</td>
          <td class="num">${escapeHtml(formatMoney(row.revenue))}</td>
          <td class="num">${escapeHtml(formatMoney(row.cost))}</td>
          <td class="num">${escapeHtml(formatMoney(row.profit))}</td>
          <td class="num">${escapeHtml(formatPercent(row.realizationPct))}</td>
        </tr>`
      )
      .join("");

    body.innerHTML = `
      <div class="analytics-panel" data-analytics-root>
        <form class="analytics-filters" data-analytics-filters>
          <label>
            <span>From</span>
            <input type="date" name="fromDate" value="${escapeHtml(uiState.fromDate)}" />
          </label>
          <label>
            <span>To</span>
            <input type="date" name="toDate" value="${escapeHtml(uiState.toDate)}" />
          </label>
          <label>
            <span>Scope</span>
            <select name="scope">
              <option value="company" ${uiState.scope === "company" ? "selected" : ""}>Company</option>
              <option value="office" ${uiState.scope === "office" ? "selected" : ""}>Office</option>
              <option value="department" ${uiState.scope === "department" ? "selected" : ""}>Department</option>
            </select>
          </label>
          <label ${uiState.scope === "company" ? "hidden" : ""}>
            <span>${uiState.scope === "office" ? "Office" : "Department"}</span>
            <select name="scopeId">${renderOptions(scopeItems, uiState.scopeId, "All")}</select>
          </label>
          <label>
            <span>Client (optional)</span>
            <select name="clientId">${renderOptions(clientProjectOptions.clients, uiState.clientId, "All")}</select>
          </label>
          <label>
            <span>Project (optional)</span>
            <select name="projectId">${renderOptions(projectItems, uiState.projectId, "All")}</select>
          </label>
          <label>
            <span>Trend metric</span>
            <select name="trendMetric">
              <option value="revenue" ${uiState.trendMetric === "revenue" ? "selected" : ""}>Revenue</option>
              <option value="cost" ${uiState.trendMetric === "cost" ? "selected" : ""}>Cost</option>
              <option value="profit" ${uiState.trendMetric === "profit" ? "selected" : ""}>Profit</option>
            </select>
          </label>
          <label>
            <span>Group by</span>
            <select name="groupBy">
              <option value="client" ${uiState.groupBy === "client" ? "selected" : ""}>Client</option>
              <option value="project" ${uiState.groupBy === "project" ? "selected" : ""}>Project</option>
              <option value="office" ${uiState.groupBy === "office" ? "selected" : ""}>Office</option>
              <option value="department" ${uiState.groupBy === "department" ? "selected" : ""}>Department</option>
              <option value="member" ${uiState.groupBy === "member" ? "selected" : ""}>Member</option>
              <option value="member_level" ${uiState.groupBy === "member_level" ? "selected" : ""}>Member level</option>
            </select>
          </label>
        </form>

        <section class="analytics-kpis">
          <article class="analytics-kpi"><div class="analytics-kpi-label">Revenue</div><div class="analytics-kpi-value">${escapeHtml(formatMoney(computed.kpis.revenue))}</div></article>
          <article class="analytics-kpi"><div class="analytics-kpi-label">Cost</div><div class="analytics-kpi-value">${escapeHtml(formatMoney(computed.kpis.cost))}</div></article>
          <article class="analytics-kpi"><div class="analytics-kpi-label">Profit</div><div class="analytics-kpi-value">${escapeHtml(formatMoney(computed.kpis.profit))}</div></article>
          <article class="analytics-kpi"><div class="analytics-kpi-label">Realization %</div><div class="analytics-kpi-value">${escapeHtml(formatPercent(computed.kpis.realizationPct))}</div></article>
          <article class="analytics-kpi"><div class="analytics-kpi-label">Total Hours</div><div class="analytics-kpi-value">${escapeHtml(formatHours(computed.kpis.totalHours))}</div></article>
        </section>

        <section class="analytics-chart-wrap">
          <div class="analytics-chart-head">
            <strong>${escapeHtml(metricLabelMap[uiState.trendMetric] || "Revenue")} trend</strong>
          </div>
          ${buildTrendSvg(computed.trend, uiState.trendMetric)}
        </section>

        <section class="analytics-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th class="num">Revenue</th>
                <th class="num">Cost</th>
                <th class="num">Profit</th>
                <th class="num">Realization %</th>
              </tr>
            </thead>
            <tbody>
              ${groupedRowsHtml || '<tr><td colspan="5">No rows for current filters.</td></tr>'}
            </tbody>
          </table>
        </section>

        <p class="analytics-footnote">Realization is computed as Revenue / Standard Revenue, where Standard Revenue is hours multiplied by base rates plus billable expense revenue in T&M context.</p>
      </div>
    `;

    const filterForm = body.querySelector("[data-analytics-filters]");
    if (!filterForm) return;

    const syncUiStateFromForm = () => {
      uiState.fromDate = safeText(filterForm.elements.fromDate?.value);
      uiState.toDate = safeText(filterForm.elements.toDate?.value);
      uiState.scope = safeText(filterForm.elements.scope?.value || "company");
      uiState.scopeId = safeText(filterForm.elements.scopeId?.value);
      uiState.clientId = safeText(filterForm.elements.clientId?.value);
      uiState.projectId = safeText(filterForm.elements.projectId?.value);
      uiState.trendMetric = safeText(filterForm.elements.trendMetric?.value || "revenue");
      uiState.groupBy = safeText(filterForm.elements.groupBy?.value || "client");
    };

    filterForm.addEventListener("change", (event) => {
      const targetName = safeText(event?.target?.name);
      syncUiStateFromForm();
      if (targetName === "scope") {
        uiState.scopeId = "";
      }
      if (targetName === "clientId") {
        const projectList = clientProjectOptions.projectsByClient.get(uiState.clientId) || [];
        const hasProject = projectList.some((item) => safeText(item?.id) === uiState.projectId);
        if (!hasProject) {
          uiState.projectId = "";
        }
      }
      renderAnalyticsPage(options);
    });
  }

  window.analyticsFeature = {
    renderAnalyticsPage,
  };
})();
