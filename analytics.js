(function () {
  const stateByContainer = new WeakMap();
  const chartInstanceByContainer = new WeakMap();
  const chartInstances = new Set();
  let chartResizeBound = false;
  const ANALYTICS_SUB_TAB_UTILIZATION = "utilization";
  const ANALYTICS_SUB_TAB_REALIZATION = "realization";
  const ANALYTICS_SUB_TAB_PROFITABILITY = "profitability";
  const ANALYTICS_SUB_TABS = [
    { key: ANALYTICS_SUB_TAB_UTILIZATION, label: "Utilization" },
    { key: ANALYTICS_SUB_TAB_REALIZATION, label: "Realization" },
    { key: ANALYTICS_SUB_TAB_PROFITABILITY, label: "Profitability" },
  ];

  function ensureStyles() {
    if (document.getElementById("analytics-phase1-style")) return;
    const style = document.createElement("style");
    style.id = "analytics-phase1-style";
    style.textContent = `
      .analytics-panel { display: grid; gap: 14px; padding-top: 2px; }
      .analytics-subtabs {
        display: inline-flex;
        gap: 8px;
        padding: 0 4px 8px;
        border-bottom: 1px solid var(--panel-border);
        width: fit-content;
      }
      .analytics-subtab {
        border: 1px solid var(--panel-border);
        background: var(--surface);
        color: var(--ink);
        border-radius: 10px 10px 4px 4px;
        padding: 8px 14px;
        font-family: var(--font-head);
        font-size: .9rem;
        letter-spacing: .01em;
        cursor: pointer;
      }
      .analytics-subtab.is-active {
        background: var(--panel);
        border-color: var(--accent);
      }
      .analytics-subtab-shell {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        padding: 14px;
        display: grid;
        gap: 8px;
      }
      .analytics-subtab-shell h3 {
        margin: 0;
        font-size: 1rem;
      }
      .analytics-subtab-shell p {
        margin: 0;
        color: var(--muted);
      }
      .analytics-filters {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 8px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        align-items: end;
      }
      .analytics-filters label { display: grid; gap: 4px; font-size: .72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .analytics-filters select, .analytics-filters input { min-height: 34px; background: #fff; }
      .analytics-filter-range { min-width: 0; }
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

  function buildInternalScopeSets(dataState) {
    const clients = Array.isArray(dataState?.clients) ? dataState.clients : [];
    const projects = Array.isArray(dataState?.projects) ? dataState.projects : [];
    const internalClientIds = new Set();
    const internalProjectIds = new Set();

    clients.forEach((client) => {
      const id = safeText(client?.id);
      const name = safeText(client?.name || client?.client || client?.clientName);
      if (id && isInternalClientName(name)) {
        internalClientIds.add(id);
      }
    });

    projects.forEach((project) => {
      const id = safeText(project?.id);
      const clientId = safeText(project?.clientId || project?.client_id);
      const clientName = safeText(project?.client || project?.clientName);
      if (!id) return;
      if (internalClientIds.has(clientId) || isInternalClientName(clientName)) {
        internalProjectIds.add(id);
      }
    });

    return { internalClientIds, internalProjectIds };
  }

  function isInternalRecord(record, internalScope) {
    const projectId = safeText(record?.projectId || record?.project_id);
    const clientId = safeText(record?.clientId || record?.client_id);
    const clientName = safeText(record?.client || record?.clientName || record?.client_name);
    if (projectId && internalScope.internalProjectIds.has(projectId)) return true;
    if (clientId && internalScope.internalClientIds.has(clientId)) return true;
    return isInternalClientName(clientName);
  }

  function excludeInternalAnalyticsData(dataState) {
    const internalScope = buildInternalScopeSets(dataState);
    const clients = (Array.isArray(dataState?.clients) ? dataState.clients : []).filter((client) => {
      const id = safeText(client?.id);
      const name = safeText(client?.name || client?.client || client?.clientName);
      if (id && internalScope.internalClientIds.has(id)) return false;
      return !isInternalClientName(name);
    });
    const projects = (Array.isArray(dataState?.projects) ? dataState.projects : []).filter((project) => {
      const id = safeText(project?.id);
      const clientId = safeText(project?.clientId || project?.client_id);
      const clientName = safeText(project?.client || project?.clientName);
      if (id && internalScope.internalProjectIds.has(id)) return false;
      if (clientId && internalScope.internalClientIds.has(clientId)) return false;
      return !isInternalClientName(clientName);
    });
    const entries = (Array.isArray(dataState?.entries) ? dataState.entries : []).filter(
      (entry) => !isInternalRecord(entry, internalScope)
    );
    const expenses = (Array.isArray(dataState?.expenses) ? dataState.expenses : []).filter(
      (expense) => !isInternalRecord(expense, internalScope)
    );

    return {
      clients,
      projects,
      entries,
      expenses,
    };
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

    const fromIso = safeText(fromInput.value);
    const toIso = safeText(toInput.value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromIso)) {
      fromInput.dataset.dpCanonical = fromIso;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(toIso)) {
      toInput.dataset.dpCanonical = toIso;
    }

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
      activeTab: ANALYTICS_SUB_TAB_PROFITABILITY,
      scope: "company",
      scopeId: "",
      clientId: "",
      projectId: "",
      trendMetric: "revenue",
    };
  }

  function normalizeAnalyticsSubTab(value) {
    const key = safeText(value).toLowerCase();
    const found = ANALYTICS_SUB_TABS.find((tab) => tab.key === key);
    return found ? found.key : ANALYTICS_SUB_TAB_PROFITABILITY;
  }

  function renderAnalyticsSubTabHtml(activeTab) {
    return `
      <div class="analytics-subtabs" role="tablist" aria-label="Analytics sections">
        ${ANALYTICS_SUB_TABS.map(
          (tab) =>
            `<button class="analytics-subtab ${activeTab === tab.key ? "is-active" : ""}" type="button" role="tab" aria-selected="${
              activeTab === tab.key ? "true" : "false"
            }" data-analytics-subtab="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>`
        ).join("")}
      </div>
    `;
  }

  function placeholderShellForSubTab(activeTab) {
    if (activeTab === ANALYTICS_SUB_TAB_UTILIZATION) {
      return `
        <section class="analytics-subtab-shell">
          <h3>Utilization</h3>
          <p>Utilization analytics is coming next.</p>
        </section>
      `;
    }
    return `
      <section class="analytics-subtab-shell">
        <h3>Realization</h3>
        <p>Realization analytics is coming next.</p>
      </section>
    `;
  }

  function bindAnalyticsSubTabEvents(body, uiState, options) {
    body.querySelectorAll("[data-analytics-subtab]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextTab = normalizeAnalyticsSubTab(button.dataset.analyticsSubtab);
        if (nextTab === uiState.activeTab) return;
        uiState.activeTab = nextTab;
        renderAnalyticsPage(options);
      });
    });
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

    const filteredData = excludeInternalAnalyticsData(appState);
    const body = container.querySelector(".analytics-body") || container;
    let uiState = stateByContainer.get(container);
    if (!uiState) {
      uiState = initialUiState({
        entries: filteredData.entries,
        expenses: filteredData.expenses,
      });
      stateByContainer.set(container, uiState);
    }
    uiState.activeTab = normalizeAnalyticsSubTab(uiState.activeTab);
    const subTabsHtml = renderAnalyticsSubTabHtml(uiState.activeTab);

    if (uiState.activeTab !== ANALYTICS_SUB_TAB_PROFITABILITY) {
      body.innerHTML = `
        <div class="analytics-panel" data-analytics-root>
          ${subTabsHtml}
          ${placeholderShellForSubTab(uiState.activeTab)}
        </div>
      `;
      bindAnalyticsSubTabEvents(body, uiState, options);
      return;
    }

    const scopeOptions = engine.listScopeOptions({
      offices: appState.officeLocations,
      departments: appState.departments,
    });
    const clientProjectOptions = engine.listClientProjectOptions({
      clients: filteredData.clients,
      projects: filteredData.projects,
    });

    const selectedClientId = uiState.clientId;
    const projectItems = selectedClientId
      ? clientProjectOptions.projectsByClient.get(selectedClientId) || []
      : [];

    const computed = engine.computeAnalytics({
      entries: filteredData.entries,
      expenses: filteredData.expenses,
      users: appState.users,
      projects: filteredData.projects,
      clients: filteredData.clients,
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
        groupBy: "client",
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

    body.innerHTML = `
      <div class="analytics-panel" data-analytics-root>
        ${subTabsHtml}
        <section class="analytics-subtab-shell">
          <h3>Profitability</h3>
          <p>Revenue, cost, and profit performance across the selected scope.</p>
        </section>
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

        <p class="analytics-footnote">Realization is computed as Revenue / Standard Revenue, where Standard Revenue is hours multiplied by base rates plus billable expense revenue in T&M context.</p>
      </div>
    `;

    bindAnalyticsSubTabEvents(body, uiState, options);
    const filterForm = body.querySelector("[data-analytics-filters]");
    if (!filterForm) return;
    wireAnalyticsDateRangePicker(filterForm);
    renderTrendChart(
      body.querySelector("[data-analytics-chart-host]"),
      computed.trend,
      uiState.trendMetric
    );

    const syncUiStateFromForm = () => {
      const fromInput = filterForm.elements.fromDate;
      const toInput = filterForm.elements.toDate;
      uiState.fromDate = safeText(fromInput?.dataset?.dpCanonical || fromInput?.value);
      uiState.toDate = safeText(toInput?.dataset?.dpCanonical || toInput?.value);
      uiState.scope = safeText(filterForm.elements.scope?.value || "company");
      uiState.scopeId = safeText(filterForm.elements.scopeId?.value);
      uiState.clientId = safeText(filterForm.elements.clientId?.value);
      uiState.projectId = safeText(filterForm.elements.projectId?.value);
      uiState.trendMetric = safeText(filterForm.elements.trendMetric?.value || "revenue");
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
