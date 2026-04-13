(function () {
  const stateByContainer = new WeakMap();
  const chartInstanceByContainer = new WeakMap();
  const chartInstances = new Set();
  let chartResizeBound = false;

  function ensureStyles() {
    if (document.getElementById("analytics-phase1-style")) return;
    const style = document.createElement("style");
    style.id = "analytics-phase1-style";
    style.textContent = `
      .analytics-panel { display: grid; gap: 14px; padding-top: 2px; }
      .analytics-filters {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: color-mix(in srgb, var(--surface) 82%, transparent);
        align-items: end;
      }
      .analytics-filters label { display: grid; gap: 4px; font-size: .72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .analytics-filters select, .analytics-filters input { min-height: 34px; }
      .analytics-filter-range { min-width: 0; }
      .analytics-filter-check {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        text-transform: none;
        letter-spacing: 0;
        font-size: .82rem;
        color: var(--text);
      }
      .analytics-filter-check input { min-height: 16px; }
      .analytics-kpis { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 10px; }
      .analytics-kpi {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 12px;
        background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 95%, #fff 5%) 0%, var(--surface) 100%);
      }
      .analytics-kpi-label { font-size: .72rem; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; }
      .analytics-kpi-value { font-size: 1.2rem; font-weight: 650; line-height: 1.2; }
      .analytics-chart-wrap { border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 6px; background: var(--surface); }
      .analytics-chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .analytics-chart-empty { color: var(--muted); font-size: .9rem; padding: 14px 0; }
      .analytics-trend-chart { width: 100%; height: 280px; }
      .analytics-table-wrap { border: 1px solid var(--line); border-radius: 10px; overflow: auto; background: var(--surface); }
      .analytics-table-wrap table { width: 100%; min-width: 760px; border-collapse: collapse; }
      .analytics-table-wrap th, .analytics-table-wrap td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; }
      .analytics-table-wrap thead th {
        font-size: .75rem;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: .04em;
        position: sticky;
        top: 0;
        background: var(--surface);
        z-index: 1;
      }
      .analytics-table-wrap td.num, .analytics-table-wrap th.num { text-align: right; }
      .analytics-table-wrap tbody tr:nth-child(even) { background: color-mix(in srgb, var(--surface) 94%, var(--line) 6%); }
      .analytics-table-wrap tbody tr:hover { background: color-mix(in srgb, var(--surface) 80%, var(--accent) 20%); }
      .analytics-table-wrap tbody td:first-child { font-weight: 560; }
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

  function isInternalClientName(name) {
    const text = safeText(name).toLowerCase();
    return text === "internal" || text === "internal work";
  }

  function formatShortDate(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return "";
    const [year, month, day] = isoDate.split("-");
    return `${month}/${day}/${year.slice(-2)}`;
  }

  function setRangeDisplayValue(input, fromIso, toIso) {
    if (!input) return;
    if (fromIso && toIso) {
      input.value = `${formatShortDate(fromIso)} – ${formatShortDate(toIso)}`;
      return;
    }
    if (fromIso) {
      input.value = `${formatShortDate(fromIso)} –`;
      return;
    }
    input.value = "Select date range";
  }

  function wireAnalyticsDateRangePicker(filterForm) {
    const rangeInput = filterForm?.elements?.dateRange;
    const fromInput = filterForm?.elements?.fromDate;
    const toInput = filterForm?.elements?.toDate;
    if (!rangeInput || !fromInput || !toInput) return;

    rangeInput.dataset.dpFilter = "true";
    rangeInput.dataset.dpRange = "true";
    rangeInput._dpRangeFrom = fromInput;
    rangeInput._dpRangeTo = toInput;
    rangeInput._dpAnchor = rangeInput;

    setRangeDisplayValue(rangeInput, safeText(fromInput.value), safeText(toInput.value));

    const picker = window.datePicker;
    if (picker && typeof picker.register === "function" && rangeInput.dataset.dpBound !== "true") {
      picker.register(rangeInput);
      setRangeDisplayValue(rangeInput, safeText(fromInput.value), safeText(toInput.value));
    }
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
      includeInternalWork: false,
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

  function bindChartResize() {
    if (chartResizeBound) return;
    chartResizeBound = true;
    window.addEventListener("resize", () => {
      chartInstances.forEach((instance) => {
        if (instance && !instance.isDisposed()) {
          instance.resize();
        }
      });
    });
  }

  function renderTrendChart(container, trend, focusMetric) {
    if (!container) return;
    const echarts = window.echarts;
    if (!echarts || typeof echarts.init !== "function") {
      container.innerHTML = '<div class="analytics-chart-empty">Chart library failed to load.</div>';
      return;
    }
    const points = trend || [];
    if (!points.length) {
      container.innerHTML = '<div class="analytics-chart-empty">No trend data for the current filter range.</div>';
      return;
    }
    const nonZeroPoints = points.filter((item) => {
      const revenue = toNumber(item?.revenue);
      const cost = toNumber(item?.cost);
      const profit = toNumber(item?.profit);
      return Math.abs(revenue) > 0.0001 || Math.abs(cost) > 0.0001 || Math.abs(profit) > 0.0001;
    }).length;
    if (nonZeroPoints === 0) {
      container.innerHTML =
        '<div class="analytics-chart-empty">Not enough meaningful data points to plot a trend yet.</div>';
      return;
    }

    container.innerHTML = '<div class="analytics-trend-chart" data-analytics-trend-chart></div>';
    const chartEl = container.querySelector("[data-analytics-trend-chart]");
    if (!chartEl) return;

    const existing = chartInstanceByContainer.get(container);
    if (existing?.instance && !existing.instance.isDisposed()) {
      chartInstances.delete(existing.instance);
      existing.instance.dispose();
    }
    const chart = echarts.init(chartEl);
    chartInstanceByContainer.set(container, { instance: chart });
    chartInstances.add(chart);
    bindChartResize();

    const labels = points.map((item) => monthLabel(item?.month));
    const costValues = points.map((item) => toNumber(item?.cost));
    const profitValues = points.map((item) => toNumber(item?.profit));
    const revenueValues = costValues.map((cost, index) => cost + profitValues[index]);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2f6fed";
    const areaCostColor = "rgba(64, 120, 192, 0.78)";
    const areaProfitColor = "rgba(74, 180, 132, 0.78)";
    const selectedMetric = safeText(focusMetric || "revenue");
    const seriesOpacity = (metricKey) => (selectedMetric === metricKey ? 1 : 0.68);

    chart.setOption({
      animation: false,
      grid: { left: 44, right: 18, top: 18, bottom: 34 },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const rows = Array.isArray(params) ? params : [];
          const first = rows[0];
          const label = first?.axisValueLabel || "";
          const byName = (name) => rows.find((row) => row?.seriesName === name)?.value ?? 0;
          return [
            label,
            `Revenue: ${formatMoney(byName("Revenue"))}`,
            `Cost: ${formatMoney(byName("Cost"))}`,
            `Profit: ${formatMoney(byName("Profit"))}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: (value) => {
            const abs = Math.abs(value);
            if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (abs >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return String(Math.round(value));
          },
        },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.25)" } },
      },
      series: [
        {
          name: "Cost",
          data: costValues,
          type: "line",
          stack: "total",
          smooth: false,
          symbol: "none",
          lineStyle: { width: 1.6, color: areaCostColor, opacity: seriesOpacity("cost") },
          itemStyle: { color: areaCostColor, opacity: seriesOpacity("cost") },
          areaStyle: { color: "rgba(64, 120, 192, 0.30)", opacity: seriesOpacity("cost") },
          emphasis: { focus: "series" },
        },
        {
          name: "Profit",
          data: profitValues,
          type: "line",
          stack: "total",
          smooth: false,
          symbol: "none",
          lineStyle: { width: 1.6, color: areaProfitColor, opacity: seriesOpacity("profit") },
          itemStyle: { color: areaProfitColor, opacity: seriesOpacity("profit") },
          areaStyle: { color: "rgba(74, 180, 132, 0.28)", opacity: seriesOpacity("profit") },
          emphasis: { focus: "series" },
        },
        {
          name: "Revenue",
          data: revenueValues,
          type: "line",
          smooth: false,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { width: selectedMetric === "revenue" ? 3 : 2.5, color: accent, opacity: seriesOpacity("revenue") },
          itemStyle: { color: accent, opacity: seriesOpacity("revenue") },
          emphasis: { focus: "series" },
        },
      ],
    });
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

    const scopeItems = uiState.scope === "office" ? scopeOptions.offices : scopeOptions.departments;
    const scopeLabel = uiState.scope === "office" ? "Office" : "Department";
    const scopeSelectorHtml =
      uiState.scope === "company"
        ? ""
        : `<label>
            <span>${escapeHtml(scopeLabel)}</span>
            <select name="scopeId">${renderOptions(scopeItems, uiState.scopeId, "All")}</select>
          </label>`;

    const visibleGroupedRows =
      uiState.groupBy === "client" && !uiState.includeInternalWork
        ? (computed.groupedRows || []).filter((row) => !isInternalClientName(row?.name))
        : computed.groupedRows || [];

    const groupedRowsHtml = visibleGroupedRows
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
          <label class="analytics-filter-range">
            <span>Date range</span>
            <input type="text" name="dateRange" value="" readonly autocomplete="off" />
            <input type="hidden" name="fromDate" value="${escapeHtml(uiState.fromDate)}" />
            <input type="hidden" name="toDate" value="${escapeHtml(uiState.toDate)}" />
          </label>
          <label>
            <span>Scope</span>
            <select name="scope">
              <option value="company" ${uiState.scope === "company" ? "selected" : ""}>Company</option>
              <option value="office" ${uiState.scope === "office" ? "selected" : ""}>Office</option>
              <option value="department" ${uiState.scope === "department" ? "selected" : ""}>Department</option>
            </select>
          </label>
          ${scopeSelectorHtml}
          <label>
            <span>Client</span>
            <select name="clientId">${renderOptions(clientProjectOptions.clients, uiState.clientId, "All")}</select>
          </label>
          <label>
            <span>Project</span>
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
          <label ${uiState.groupBy === "client" ? "" : "hidden"}>
            <span>Client visibility</span>
            <div class="analytics-filter-check">
              <input type="checkbox" name="includeInternalWork" ${uiState.includeInternalWork ? "checked" : ""} />
              <span>Include internal work</span>
            </div>
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
            <strong>Revenue vs Cost + Profit trend</strong>
          </div>
          <div data-analytics-chart-host></div>
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
    wireAnalyticsDateRangePicker(filterForm);
    renderTrendChart(
      body.querySelector("[data-analytics-chart-host]"),
      computed.trend,
      uiState.trendMetric
    );

    const syncUiStateFromForm = () => {
      uiState.fromDate = safeText(filterForm.elements.fromDate?.value);
      uiState.toDate = safeText(filterForm.elements.toDate?.value);
      uiState.scope = safeText(filterForm.elements.scope?.value || "company");
      uiState.scopeId = safeText(filterForm.elements.scopeId?.value);
      uiState.clientId = safeText(filterForm.elements.clientId?.value);
      uiState.projectId = safeText(filterForm.elements.projectId?.value);
      uiState.trendMetric = safeText(filterForm.elements.trendMetric?.value || "revenue");
      uiState.groupBy = safeText(filterForm.elements.groupBy?.value || "client");
      uiState.includeInternalWork = Boolean(filterForm.elements.includeInternalWork?.checked);
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
