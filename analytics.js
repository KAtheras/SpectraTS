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
      .analytics-util-filters {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        align-items: end;
      }
      .analytics-util-filters label { display: grid; gap: 4px; font-size: .72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
      .analytics-util-filters select { min-height: 34px; background: #fff; }
      .analytics-util-grid {
        display: grid;
        grid-template-columns: minmax(320px, 2fr) minmax(420px, 3fr);
        gap: 10px;
        align-items: stretch;
      }
      .analytics-util-shared-legend {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        align-items: center;
        padding: 0 2px;
      }
      .analytics-util-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: .78rem;
        color: var(--muted);
      }
      .analytics-util-legend-swatch {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: inline-block;
      }
      .analytics-member-title-select {
        appearance: none;
        min-height: 28px;
        padding: 0 28px 0 8px;
        border-radius: 7px;
        border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        color: color-mix(in srgb, var(--ink) 72%, var(--muted) 28%);
        font-size: .82rem;
        font-weight: 560;
      }
      .analytics-member-title-select:focus-visible {
        outline: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
        outline-offset: 1px;
      }
      .analytics-member-title-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .analytics-member-title-chevron {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: color-mix(in srgb, var(--ink) 52%, var(--muted) 48%);
        font-size: .72rem;
        pointer-events: none;
        line-height: 1;
      }
      .analytics-util-select-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: 100%;
      }
      .analytics-util-select {
        appearance: none;
        width: 100%;
        min-height: 34px;
        padding-right: 28px;
      }
      .analytics-util-select-wrap .analytics-member-title-chevron {
        right: 10px;
        font-size: .7rem;
      }
      .analytics-util-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        background: var(--surface);
        padding: 10px 10px 8px;
        min-height: 430px;
      }
      .analytics-util-left-scroll {
        height: 380px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 4px;
      }
      .analytics-util-left-chart {
        min-height: 260px;
      }
      .analytics-util-right-chart {
        width: 100%;
        height: 380px;
      }
      .analytics-realization-controls {
        display: grid;
        grid-template-columns: auto repeat(3, minmax(0, 1fr));
        gap: 8px;
        align-items: end;
      }
      .analytics-realization-layer {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 9px;
        padding: 3px;
        background: var(--surface);
      }
      .analytics-realization-layer button {
        border: 0;
        background: transparent;
        color: var(--muted);
        border-radius: 6px;
        padding: 5px 10px;
        font-size: .8rem;
        font-weight: 620;
        cursor: pointer;
      }
      .analytics-realization-layer button.is-active {
        background: color-mix(in srgb, var(--accent) 14%, var(--surface) 86%);
        color: var(--ink);
      }
      .analytics-realization-layer button:disabled {
        cursor: not-allowed;
        opacity: .52;
      }
      .analytics-realization-chart {
        width: 100%;
        height: 340px;
      }
      .analytics-realization-trend {
        width: 100%;
        height: 280px;
      }
      @media (max-width: 980px) {
        .analytics-util-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .analytics-util-grid { grid-template-columns: minmax(0, 1fr); }
        .analytics-util-card { min-height: 340px; }
        .analytics-util-left-scroll { height: 300px; }
        .analytics-util-right-chart { height: 300px; }
        .analytics-realization-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .analytics-realization-layer { grid-column: 1 / -1; }
      }
      @media (max-width: 640px) {
        .analytics-util-filters { grid-template-columns: minmax(0, 1fr); }
        .analytics-realization-controls { grid-template-columns: minmax(0, 1fr); }
      }
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

  function wrapTwoLineLabel(text, maxCharsPerLine) {
    const source = safeText(text);
    if (!source) return "";
    const maxChars = Math.max(8, Number(maxCharsPerLine) || 16);
    if (source.length <= maxChars) return source;
    const words = source.split(/\s+/).filter(Boolean);
    if (!words.length) return source;

    const lines = [];
    let current = "";
    words.forEach((word) => {
      if (!current) {
        current = word;
        return;
      }
      const next = `${current} ${word}`;
      if (next.length <= maxChars) {
        current = next;
        return;
      }
      lines.push(current);
      current = word;
    });
    if (current) lines.push(current);

    if (lines.length <= 2) return lines.join("\n");
    const second = lines[1];
    const clippedSecond = second.length > maxChars - 1 ? `${second.slice(0, maxChars - 1)}…` : `${second}…`;
    return `${lines[0]}\n${clippedSecond}`;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function startOfQuarter(date) {
    const month = date.getMonth();
    const quarterStartMonth = month - (month % 3);
    return new Date(date.getFullYear(), quarterStartMonth, 1);
  }

  function endOfQuarter(date) {
    const start = startOfQuarter(date);
    return new Date(start.getFullYear(), start.getMonth() + 3, 0);
  }

  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function startOfWeekMonday(date) {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(date, diff);
  }

  const UTILIZATION_PERIODS = [
    { id: "this_week", name: "This Week" },
    { id: "last_week", name: "Last Week" },
    { id: "this_month", name: "This Month" },
    { id: "last_month", name: "Last Month" },
    { id: "this_quarter", name: "This Quarter" },
    { id: "last_quarter", name: "Last Quarter" },
    { id: "ytd", name: "YTD" },
    { id: "last_year", name: "Last Year" },
  ];

  const UTILIZATION_GROUP_BY_OPTIONS = [
    { id: "member", name: "Member" },
    { id: "title", name: "Title" },
    { id: "department", name: "Department" },
    { id: "office", name: "Office" },
  ];

  const UTILIZATION_MEMBER_SORT_OPTIONS = [
    { id: "high_to_low", name: "High → Low" },
    { id: "low_to_high", name: "Low → High" },
  ];
  const UTILIZATION_MEMBER_TITLE_ALL = "__all_titles__";
  const REALIZATION_LAYER_OPTIONS = [
    { id: "completed", name: "Completed" },
    { id: "open", name: "Open" },
    { id: "combined", name: "Combined" },
  ];
  const REALIZATION_PERIODS = [
    { id: "this_quarter", name: "This Quarter" },
    { id: "last_quarter", name: "Last Quarter" },
    { id: "ytd", name: "YTD" },
    { id: "last_year", name: "Last Year" },
  ];
  const REALIZATION_GROUP_BY_OPTIONS = [
    { id: "client", name: "Client" },
    { id: "project", name: "Project" },
    { id: "department", name: "Department" },
    { id: "office", name: "Office" },
  ];
  const REALIZATION_SORT_OPTIONS = [
    { id: "high_to_low", name: "High → Low" },
    { id: "low_to_high", name: "Low → High" },
  ];

  function normalizeUtilizationPeriod(value) {
    const key = safeText(value).toLowerCase();
    return UTILIZATION_PERIODS.some((item) => item.id === key) ? key : "this_month";
  }

  function normalizeUtilizationGroupBy(value) {
    const key = safeText(value).toLowerCase();
    return UTILIZATION_GROUP_BY_OPTIONS.some((item) => item.id === key) ? key : "member";
  }

  function normalizeUtilizationMemberSort(value) {
    const key = safeText(value).toLowerCase();
    return UTILIZATION_MEMBER_SORT_OPTIONS.some((item) => item.id === key) ? key : "high_to_low";
  }

  function utilizationSortValue(row) {
    const n = Number(row?.utilizationPct);
    return Number.isFinite(n) ? n : -1;
  }

  function sortUtilizationRowsForUi(rows, groupBy, memberSortOrder) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (normalizeUtilizationGroupBy(groupBy) !== "member") return list;
    const order = normalizeUtilizationMemberSort(memberSortOrder);
    list.sort((a, b) => {
      const left = utilizationSortValue(a);
      const right = utilizationSortValue(b);
      if (order === "low_to_high") {
        return left - right || safeText(a?.name).localeCompare(safeText(b?.name));
      }
      return right - left || safeText(a?.name).localeCompare(safeText(b?.name));
    });
    return list;
  }

  function nextUtilizationMemberSort(current) {
    return normalizeUtilizationMemberSort(current) === "high_to_low" ? "low_to_high" : "high_to_low";
  }

  function normalizeUtilizationMemberTitle(value) {
    const key = safeText(value);
    return key || UTILIZATION_MEMBER_TITLE_ALL;
  }

  function memberTitleLabel(row) {
    return safeText(row?.memberTitle) || "Unassigned";
  }

  function memberTitleByRowKey(rows) {
    const index = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = safeText(row?.key);
      if (!key) return;
      index.set(key, memberTitleLabel(row));
    });
    return index;
  }

  function filterUtilizationRowsByMemberTitle(rows, groupBy, selectedTitle) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (normalizeUtilizationGroupBy(groupBy) !== "member") return list;
    const selected = normalizeUtilizationMemberTitle(selectedTitle);
    if (selected === UTILIZATION_MEMBER_TITLE_ALL) return list;
    return list.filter((row) => memberTitleLabel(row) === selected);
  }

  function utilizationPeriodRange(periodId, nowDate) {
    const now = nowDate instanceof Date ? nowDate : new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const period = normalizeUtilizationPeriod(periodId);

    if (period === "this_week") {
      return { fromDate: toIsoDate(startOfWeekMonday(todayDate)), toDate: toIsoDate(todayDate) };
    }
    if (period === "last_week") {
      const thisWeekMonday = startOfWeekMonday(todayDate);
      const lastWeekMonday = addDays(thisWeekMonday, -7);
      const lastWeekSunday = addDays(thisWeekMonday, -1);
      return { fromDate: toIsoDate(lastWeekMonday), toDate: toIsoDate(lastWeekSunday) };
    }
    if (period === "this_month") {
      return { fromDate: toIsoDate(startOfMonth(todayDate)), toDate: toIsoDate(endOfMonth(todayDate)) };
    }
    if (period === "last_month") {
      const month = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      return { fromDate: toIsoDate(startOfMonth(month)), toDate: toIsoDate(endOfMonth(month)) };
    }
    if (period === "this_quarter") {
      return { fromDate: toIsoDate(startOfQuarter(todayDate)), toDate: toIsoDate(endOfQuarter(todayDate)) };
    }
    if (period === "last_quarter") {
      const startThisQuarter = startOfQuarter(todayDate);
      const anyLastQuarterDate = new Date(startThisQuarter.getFullYear(), startThisQuarter.getMonth() - 1, 1);
      return { fromDate: toIsoDate(startOfQuarter(anyLastQuarterDate)), toDate: toIsoDate(endOfQuarter(anyLastQuarterDate)) };
    }
    if (period === "ytd") {
      return { fromDate: `${todayDate.getFullYear()}-01-01`, toDate: toIsoDate(todayDate) };
    }
    if (period === "last_year") {
      const year = todayDate.getFullYear() - 1;
      return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
    }
    return { fromDate: toIsoDate(startOfMonth(todayDate)), toDate: toIsoDate(endOfMonth(todayDate)) };
  }

  function normalizeRealizationLayer(value) {
    const key = safeText(value).toLowerCase();
    return REALIZATION_LAYER_OPTIONS.some((item) => item.id === key) ? key : "completed";
  }

  function normalizeRealizationPeriod(value) {
    const key = safeText(value).toLowerCase();
    return REALIZATION_PERIODS.some((item) => item.id === key) ? key : "this_quarter";
  }

  function normalizeRealizationGroupBy(value) {
    const key = safeText(value).toLowerCase();
    return REALIZATION_GROUP_BY_OPTIONS.some((item) => item.id === key) ? key : "client";
  }

  function normalizeRealizationSort(value) {
    const key = safeText(value).toLowerCase();
    return REALIZATION_SORT_OPTIONS.some((item) => item.id === key) ? key : "high_to_low";
  }

  function nextRealizationSort(current) {
    return normalizeRealizationSort(current) === "high_to_low" ? "low_to_high" : "high_to_low";
  }

  function realizationPeriodRange(periodId, nowDate) {
    const now = nowDate instanceof Date ? nowDate : new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const period = normalizeRealizationPeriod(periodId);
    if (period === "this_quarter") {
      return { fromDate: toIsoDate(startOfQuarter(todayDate)), toDate: toIsoDate(endOfQuarter(todayDate)) };
    }
    if (period === "last_quarter") {
      const startThisQuarter = startOfQuarter(todayDate);
      const anyLastQuarterDate = new Date(startThisQuarter.getFullYear(), startThisQuarter.getMonth() - 1, 1);
      return { fromDate: toIsoDate(startOfQuarter(anyLastQuarterDate)), toDate: toIsoDate(endOfQuarter(anyLastQuarterDate)) };
    }
    if (period === "ytd") {
      return { fromDate: `${todayDate.getFullYear()}-01-01`, toDate: toIsoDate(todayDate) };
    }
    if (period === "last_year") {
      const year = todayDate.getFullYear() - 1;
      return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
    }
    return { fromDate: toIsoDate(startOfQuarter(todayDate)), toDate: toIsoDate(endOfQuarter(todayDate)) };
  }

  function sortRealizationRows(rows, sortOrder) {
    const order = normalizeRealizationSort(sortOrder);
    const list = Array.isArray(rows) ? [...rows] : [];
    list.sort((a, b) => {
      const left = Number.isFinite(Number(a?.realizationPct)) ? Number(a.realizationPct) : -1;
      const right = Number.isFinite(Number(b?.realizationPct)) ? Number(b.realizationPct) : -1;
      if (order === "low_to_high") {
        return left - right || safeText(a?.name).localeCompare(safeText(b?.name));
      }
      return right - left || safeText(a?.name).localeCompare(safeText(b?.name));
    });
    return list;
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
      utilizationPeriod: "this_month",
      utilizationGroupBy: "member",
      utilizationOfficeId: "",
      utilizationDepartmentId: "",
      utilizationSelectedKey: "",
      utilizationMemberSort: "high_to_low",
      utilizationMemberTitle: UTILIZATION_MEMBER_TITLE_ALL,
      realizationLayer: "completed",
      realizationPeriod: "this_quarter",
      realizationOfficeId: "",
      realizationDepartmentId: "",
      realizationGroupBy: "client",
      realizationSort: "high_to_low",
      realizationSelectedKey: "",
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

  function renderUtilizationOverviewChart(options) {
    const container = options?.container;
    const rows = Array.isArray(options?.rows) ? options.rows : [];
    const groupByLabel = safeText(options?.groupByLabel || "Group");
    const selectedKey = safeText(options?.selectedKey);
    const onSelect = typeof options?.onSelect === "function" ? options.onSelect : null;
    if (!container) return;
    const echarts = window.echarts;
    if (!echarts || typeof echarts.init !== "function") {
      container.innerHTML = '<div class="analytics-chart-empty">Chart library failed to load.</div>';
      return;
    }
    if (!rows.length) {
      container.innerHTML = '<div class="analytics-chart-empty">No utilization data for the selected filters.</div>';
      return;
    }
    const scrollHost = container.closest(".analytics-util-left-scroll");
    const availableHeight = Number(scrollHost?.clientHeight) || 380;
    const chartHeight = Math.max(availableHeight, rows.length * 42);
    container.innerHTML = `<div class="analytics-util-left-chart" data-analytics-util-left-chart style="height:${chartHeight}px;"></div>`;
    const resolvedChartEl = container.querySelector("[data-analytics-util-left-chart]");
    if (!resolvedChartEl) return;

    const existing = chartInstanceByContainer.get(container);
    if (existing?.instance && !existing.instance.isDisposed()) {
      chartInstances.delete(existing.instance);
      existing.instance.dispose();
    }
    const chart = echarts.init(resolvedChartEl);
    chartInstanceByContainer.set(container, { instance: chart });
    chartInstances.add(chart);
    bindChartResize();

    const labels = rows.map((item) => safeText(item?.name));
    const makeSeriesData = (key) =>
      rows.map((row) => {
        const isSelected = safeText(row?.key) === selectedKey;
        return {
          value: toNumber(row?.[key]),
          itemStyle: {
            opacity: isSelected ? 1 : 0.42,
            borderColor: isSelected ? "#193f94" : "transparent",
            borderWidth: isSelected ? 1.2 : 0,
          },
        };
      });
    const capacityByIndex = rows.map((item) =>
      toNumber(item?.clientHours) + toNumber(item?.internalHours) + toNumber(item?.ptoHours) + toNumber(item?.idleHours)
    );
    const utilizationLabelByIndex = rows.map((item) => formatPercent(item?.utilizationPct));

    chart.setOption({
      animation: false,
      grid: { left: 118, right: 22, top: 26, bottom: 28, containLabel: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const rowsData = Array.isArray(params) ? params : [];
          const first = rowsData[0];
          const label = first?.axisValueLabel || "";
          const dataIndex = Number(first?.dataIndex);
          const sample = Number.isInteger(dataIndex) ? rows[dataIndex] : null;
          const get = (name) => toNumber(rowsData.find((row) => row?.seriesName === name)?.value?.value ?? rowsData.find((row) => row?.seriesName === name)?.value);
          const c = get("Client");
          const i = get("Internal");
          const p = get("PTO");
          const d = get("Idle");
          const cap = sample ? toNumber(sample.capacityHours) : c + i + p + d;
          const util = sample ? sample.utilizationPct : cap > 0 ? (c / cap) * 100 : null;
          return [
            `${escapeHtml(groupByLabel)}: ${escapeHtml(label)}`,
            `Utilization: ${formatPercent(util)}`,
            `Client: ${formatHours(c)}`,
            `Internal: ${formatHours(i)}`,
            `PTO: ${formatHours(p)}`,
            `Idle: ${formatHours(d)}`,
            `Capacity: ${formatHours(cap)}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "value",
        max: (value) => {
          const maxValue = toNumber(value?.max);
          if (maxValue <= 0) return 1;
          return maxValue * 1.08;
        },
        axisLabel: {
          formatter: (value) => `${Math.round(value)}`,
          margin: 10,
          hideOverlap: true,
        },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.25)" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: labels,
        axisTick: { show: false },
        axisLabel: {
          width: 168,
          lineHeight: 18,
          formatter: (value, index) => {
            const row = rows[index];
            const prefix = safeText(row?.key) === selectedKey ? "● " : "";
            return `${prefix}${wrapTwoLineLabel(value, 18)}`;
          },
        },
      },
      series: [
        { name: "Client", type: "bar", stack: "hours", data: makeSeriesData("clientHours"), itemStyle: { color: "#2f9988" } },
        { name: "Internal", type: "bar", stack: "hours", data: makeSeriesData("internalHours"), itemStyle: { color: "#2f6fed" } },
        { name: "PTO", type: "bar", stack: "hours", data: makeSeriesData("ptoHours"), itemStyle: { color: "#9a78d1" } },
        { name: "Idle", type: "bar", stack: "hours", data: makeSeriesData("idleHours"), itemStyle: { color: "#b8bdc7" } },
        {
          name: "__utilization_label__",
          type: "bar",
          data: capacityByIndex,
          barGap: "-100%",
          silent: true,
          tooltip: { show: false },
          itemStyle: { color: "rgba(0,0,0,0)" },
          label: {
            show: true,
            position: "right",
            distance: 6,
            color: "#283142",
            fontSize: 12,
            fontWeight: 700,
            formatter: (params) => safeText(utilizationLabelByIndex[Number(params?.dataIndex)]),
            hideOverlap: true,
          },
          z: 20,
          zlevel: 0,
          emphasis: { disabled: true },
          select: { disabled: true },
          blur: { itemStyle: { opacity: 0 } },
        },
      ],
    });

    // Keep left chart labels visible in dense lists by preferring display over animation interpolation.
    chart.setOption({
      animation: false,
      series: [
        {},
        {},
        {},
        {},
        {
          labelLayout: { hideOverlap: true },
        },
      ],
    });

    chart.off("click");
    chart.on("click", (params) => {
      const dataIndex = Number(params?.dataIndex);
      if (!Number.isInteger(dataIndex)) return;
      const row = rows[dataIndex];
      const key = safeText(row?.key);
      if (!key || key === selectedKey || !onSelect) return;
      onSelect(key);
    });
  }

  function renderUtilizationDetailChart(options) {
    const container = options?.container;
    const seriesRows = Array.isArray(options?.seriesRows) ? options.seriesRows : [];
    if (!container) return;
    const echarts = window.echarts;
    if (!echarts || typeof echarts.init !== "function") {
      container.innerHTML = '<div class="analytics-chart-empty">Chart library failed to load.</div>';
      return;
    }
    if (!seriesRows.length) {
      container.innerHTML = '<div class="analytics-chart-empty">No time-bucket utilization data for the selected item.</div>';
      return;
    }

    container.innerHTML = '<div class="analytics-util-right-chart" data-analytics-util-right-chart></div>';
    const chartEl = container.querySelector("[data-analytics-util-right-chart]");
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

    const labels = seriesRows.map((item) => safeText(item?.label));
    const client = seriesRows.map((item) => toNumber(item?.clientHours));
    const internal = seriesRows.map((item) => toNumber(item?.internalHours));
    const pto = seriesRows.map((item) => toNumber(item?.ptoHours));
    const idle = seriesRows.map((item) => toNumber(item?.idleHours));
    const totals = seriesRows.map((item) =>
      toNumber(item?.clientHours) + toNumber(item?.internalHours) + toNumber(item?.ptoHours) + toNumber(item?.idleHours)
    );
    const utilizationLabelByIndex = seriesRows.map((item) => formatPercent(item?.utilizationPct));

    chart.setOption({
      animation: false,
      grid: { left: 46, right: 20, top: 34, bottom: 56 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const rowsData = Array.isArray(params) ? params : [];
          const first = rowsData[0];
          const index = Number(first?.dataIndex);
          const point = Number.isInteger(index) ? seriesRows[index] : null;
          const get = (name) => toNumber(rowsData.find((row) => row?.seriesName === name)?.value);
          const c = get("Client");
          const i = get("Internal");
          const p = get("PTO");
          const d = get("Idle");
          return [
            safeText(first?.axisValueLabel),
            `Utilization: ${formatPercent(point?.utilizationPct)}`,
            `Client: ${formatHours(c)}`,
            `Internal: ${formatHours(i)}`,
            `PTO: ${formatHours(p)}`,
            `Idle: ${formatHours(d)}`,
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
        max: (value) => {
          const maxValue = toNumber(value?.max);
          if (maxValue <= 0) return 1;
          return maxValue * 1.12;
        },
        axisLabel: { formatter: (value) => `${Math.round(value)}` },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.25)" } },
      },
      series: [
        { name: "Client", type: "bar", stack: "hours", data: client, itemStyle: { color: "#2f9988" } },
        { name: "Internal", type: "bar", stack: "hours", data: internal, itemStyle: { color: "#2f6fed" } },
        { name: "PTO", type: "bar", stack: "hours", data: pto, itemStyle: { color: "#9a78d1" } },
        { name: "Idle", type: "bar", stack: "hours", data: idle, itemStyle: { color: "#b8bdc7" } },
        {
          name: "__utilization_label__",
          type: "bar",
          data: totals,
          barGap: "-100%",
          silent: true,
          tooltip: { show: false },
          itemStyle: { color: "rgba(0,0,0,0)" },
          label: {
            show: true,
            position: "top",
            distance: 4,
            color: "#283142",
            fontSize: 11,
            fontWeight: 700,
            formatter: (params) => safeText(utilizationLabelByIndex[Number(params?.dataIndex)]),
            hideOverlap: true,
          },
          z: 10,
          emphasis: { disabled: true },
          select: { disabled: true },
        },
      ],
    });
  }

  function renderRealizationPrimaryChart(options) {
    const container = options?.container;
    const rows = Array.isArray(options?.rows) ? options.rows : [];
    const groupByLabel = safeText(options?.groupByLabel || "Group");
    const selectedKey = safeText(options?.selectedKey);
    const onSelect = typeof options?.onSelect === "function" ? options.onSelect : null;
    if (!container) return;
    const echarts = window.echarts;
    if (!echarts || typeof echarts.init !== "function") {
      container.innerHTML = '<div class="analytics-chart-empty">Chart library failed to load.</div>';
      return;
    }
    if (!rows.length) {
      container.innerHTML = '<div class="analytics-chart-empty">No completed-project realization data for the selected filters.</div>';
      return;
    }
    container.innerHTML = '<div class="analytics-realization-chart" data-analytics-realization-chart></div>';
    const chartEl = container.querySelector("[data-analytics-realization-chart]");
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

    const labels = rows.map((row) => safeText(row?.name));
    const values = rows.map((row) => {
      const isSelected = safeText(row?.key) === selectedKey;
      return {
        value: Number.isFinite(Number(row?.realizationPct)) ? Number(row.realizationPct) : 0,
        itemStyle: {
          opacity: isSelected ? 1 : 0.72,
          borderColor: isSelected ? "#193f94" : "transparent",
          borderWidth: isSelected ? 1.2 : 0,
        },
      };
    });
    const maxValue = Math.max(100, ...rows.map((row) => Number.isFinite(Number(row?.realizationPct)) ? Number(row.realizationPct) : 0));

    chart.setOption({
      animation: false,
      grid: { left: 180, right: 24, top: 22, bottom: 28 },
      tooltip: {
        trigger: "item",
        formatter: (param) => {
          const row = rows[Number(param?.dataIndex)] || null;
          return [
            `${escapeHtml(groupByLabel)}: ${escapeHtml(safeText(row?.name))}`,
            `Realization: ${formatPercent(row?.realizationPct)}`,
            `Actual: ${formatMoney(row?.actualRevenue)}`,
            `Standard: ${formatMoney(row?.standardRevenue)}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "value",
        max: maxValue * 1.12,
        axisLabel: { formatter: (value) => `${Math.round(value)}%` },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.25)" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: labels,
        axisTick: { show: false },
        axisLabel: {
          width: 160,
          lineHeight: 17,
          formatter: (value) => wrapTwoLineLabel(value, 24),
        },
      },
      series: [
        {
          type: "bar",
          data: values,
          barWidth: 18,
          itemStyle: { color: "#2f6fed" },
          label: {
            show: true,
            position: "right",
            distance: 6,
            color: "#283142",
            fontSize: 12,
            fontWeight: 700,
            formatter: (params) => formatPercent(rows[Number(params?.dataIndex)]?.realizationPct),
          },
        },
      ],
    });

    chart.off("click");
    chart.on("click", (params) => {
      const dataIndex = Number(params?.dataIndex);
      if (!Number.isInteger(dataIndex)) return;
      const row = rows[dataIndex];
      const key = safeText(row?.key);
      if (!key || key === selectedKey || !onSelect) return;
      onSelect(key);
    });
  }

  function renderRealizationTrendChart(options) {
    const container = options?.container;
    const seriesRows = Array.isArray(options?.seriesRows) ? options.seriesRows : [];
    if (!container) return;
    const echarts = window.echarts;
    if (!echarts || typeof echarts.init !== "function") {
      container.innerHTML = '<div class="analytics-chart-empty">Chart library failed to load.</div>';
      return;
    }
    if (!seriesRows.length) {
      container.innerHTML = '<div class="analytics-chart-empty">No monthly realization trend for the selected item.</div>';
      return;
    }
    container.innerHTML = '<div class="analytics-realization-trend" data-analytics-realization-trend></div>';
    const chartEl = container.querySelector("[data-analytics-realization-trend]");
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

    const labels = seriesRows.map((row) => {
      const month = safeText(row?.month);
      if (!month) return "";
      const [year, mm] = month.split("-");
      const date = new Date(Number(year), Number(mm) - 1, 1);
      return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    });
    const values = seriesRows.map((row) => (Number.isFinite(Number(row?.realizationPct)) ? Number(row.realizationPct) : 0));
    const maxValue = Math.max(100, ...values);

    chart.setOption({
      animation: false,
      grid: { left: 50, right: 20, top: 24, bottom: 52 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const first = Array.isArray(params) ? params[0] : params;
          const idx = Number(first?.dataIndex);
          const row = Number.isInteger(idx) ? seriesRows[idx] : null;
          return [
            safeText(first?.axisValueLabel),
            `Realization: ${formatPercent(row?.realizationPct)}`,
            `Actual: ${formatMoney(row?.actualRevenue)}`,
            `Standard: ${formatMoney(row?.standardRevenue)}`,
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
        max: maxValue * 1.12,
        axisLabel: { formatter: (value) => `${Math.round(value)}%` },
        splitLine: { lineStyle: { color: "rgba(128,128,128,0.25)" } },
      },
      series: [
        {
          name: "Realization %",
          type: "bar",
          barWidth: 22,
          data: values,
          itemStyle: { color: "#2f6fed", borderRadius: [4, 4, 0, 0] },
          label: {
            show: true,
            position: "top",
            distance: 4,
            color: "#283142",
            fontSize: 11,
            fontWeight: 700,
            formatter: (params) => formatPercent(seriesRows[Number(params?.dataIndex)]?.realizationPct),
          },
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

    const profitabilityData = excludeInternalAnalyticsData(appState);
    const utilizationData = {
      entries: Array.isArray(appState?.utilizationEntries)
        ? appState.utilizationEntries
        : (Array.isArray(appState?.entries) ? appState.entries : []),
      users: Array.isArray(appState?.users) || Array.isArray(appState?.inactiveUsers)
        ? (
          Array.isArray(appState?.utilizationUsers) && appState.utilizationUsers.length
            ? appState.utilizationUsers
            : Array.from(
            new Map(
              [...(Array.isArray(appState?.users) ? appState.users : []), ...(Array.isArray(appState?.inactiveUsers) ? appState.inactiveUsers : [])]
                .filter(Boolean)
                .map((user) => [safeText(user?.id || user?.userId || user?.user_id) || safeText(user?.username || user?.displayName), user])
                .filter((pair) => safeText(pair[0]))
            ).values()
          )
        )
        : [],
      projects: Array.isArray(appState?.projects) ? appState.projects : [],
      clients: Array.isArray(appState?.clients) ? appState.clients : [],
    };
    const body = container.querySelector(".analytics-body") || container;
    let uiState = stateByContainer.get(container);
    if (!uiState) {
      uiState = initialUiState({
        entries: profitabilityData.entries,
        expenses: profitabilityData.expenses,
      });
      stateByContainer.set(container, uiState);
    }
    uiState.activeTab = normalizeAnalyticsSubTab(uiState.activeTab);
    const subTabsHtml = renderAnalyticsSubTabHtml(uiState.activeTab);

    if (uiState.activeTab === ANALYTICS_SUB_TAB_REALIZATION) {
      uiState.realizationLayer = normalizeRealizationLayer(uiState.realizationLayer);
      uiState.realizationPeriod = normalizeRealizationPeriod(uiState.realizationPeriod);
      uiState.realizationGroupBy = normalizeRealizationGroupBy(uiState.realizationGroupBy);
      uiState.realizationSort = normalizeRealizationSort(uiState.realizationSort);
      const scopeOptions = engine.listScopeOptions({
        offices: appState.officeLocations,
        departments: appState.departments,
      });
      const periodRange = realizationPeriodRange(uiState.realizationPeriod, new Date());
      const isCompletedLayer = uiState.realizationLayer === "completed";
      const realizationComputed =
        isCompletedLayer && typeof engine.computeRealizationAnalytics === "function"
          ? engine.computeRealizationAnalytics({
              entries: profitabilityData.entries,
              expenses: profitabilityData.expenses,
              users: appState.users,
              projects: profitabilityData.projects,
              clients: profitabilityData.clients,
              offices: appState.officeLocations,
              departments: appState.departments,
              assignments: appState.assignments,
              levelLabels: appState.levelLabels,
              filters: {
                fromDate: periodRange.fromDate,
                toDate: periodRange.toDate,
                groupBy: uiState.realizationGroupBy,
                officeId: uiState.realizationOfficeId,
                departmentId: uiState.realizationDepartmentId,
              },
            })
          : { kpis: {}, rows: [], monthlyByKey: {} };
      const realizationRows = sortRealizationRows(realizationComputed.rows, uiState.realizationSort);
      const availableKeys = new Set(realizationRows.map((row) => safeText(row?.key)).filter(Boolean));
      const selectedKey = safeText(uiState.realizationSelectedKey);
      if (!selectedKey || !availableKeys.has(selectedKey)) {
        uiState.realizationSelectedKey = safeText(realizationRows[0]?.key);
      }
      const selectedRow =
        realizationRows.find((row) => safeText(row?.key) === safeText(uiState.realizationSelectedKey)) || null;
      const selectedSeries =
        selectedRow && realizationComputed.monthlyByKey
          ? Array.isArray(realizationComputed.monthlyByKey[selectedRow.key])
            ? realizationComputed.monthlyByKey[selectedRow.key]
            : []
          : [];
      const groupByLabel =
        REALIZATION_GROUP_BY_OPTIONS.find((item) => item.id === uiState.realizationGroupBy)?.name || "Client";

      body.innerHTML = `
        <div class="analytics-panel" data-analytics-root>
          ${subTabsHtml}
          <form class="analytics-realization-controls" data-analytics-realization-controls>
            <div class="analytics-realization-layer" role="group" aria-label="Realization layer">
              ${REALIZATION_LAYER_OPTIONS.map((item) => {
                const active = uiState.realizationLayer === item.id;
                const enabled = item.id !== "combined";
                return `<button type="button" data-analytics-realization-layer="${escapeHtml(item.id)}" ${
                  enabled ? "" : "disabled"
                } class="${active ? "is-active" : ""}">${escapeHtml(item.name)}</button>`;
              }).join("")}
            </div>
            <label>
              <span>Period</span>
              <span class="analytics-util-select-wrap">
                <select name="realizationPeriod" class="analytics-util-select">${renderOptions(
                  REALIZATION_PERIODS,
                  uiState.realizationPeriod
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>
            <label>
              <span>Office</span>
              <span class="analytics-util-select-wrap">
                <select name="realizationOfficeId" class="analytics-util-select">${renderOptions(
                  scopeOptions.offices,
                  uiState.realizationOfficeId,
                  "All"
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>
            <label>
              <span>Department</span>
              <span class="analytics-util-select-wrap">
                <select name="realizationDepartmentId" class="analytics-util-select">${renderOptions(
                  scopeOptions.departments,
                  uiState.realizationDepartmentId,
                  "All"
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>
          </form>

          <section class="analytics-kpis" style="grid-template-columns:repeat(3,minmax(140px,1fr));">
            <article class="analytics-kpi"><div class="analytics-kpi-label">Avg Realization %</div><div class="analytics-kpi-value">${escapeHtml(
              isCompletedLayer ? formatPercent(realizationComputed.kpis.avgRealizationPct) : "—"
            )}</div></article>
            <article class="analytics-kpi"><div class="analytics-kpi-label">Actual Revenue</div><div class="analytics-kpi-value">${escapeHtml(
              isCompletedLayer ? formatMoney(realizationComputed.kpis.actualRevenue) : "—"
            )}</div></article>
            <article class="analytics-kpi"><div class="analytics-kpi-label">Standard Revenue</div><div class="analytics-kpi-value">${escapeHtml(
              isCompletedLayer ? formatMoney(realizationComputed.kpis.standardRevenue) : "—"
            )}</div></article>
          </section>

          <section class="analytics-chart-wrap">
            <div class="analytics-chart-head">
              <span class="analytics-util-select-wrap" style="max-width:220px;">
                <select name="realizationGroupBy" data-analytics-realization-groupby class="analytics-util-select">
                  ${renderOptions(REALIZATION_GROUP_BY_OPTIONS, uiState.realizationGroupBy)}
                </select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
              <button
                type="button"
                data-analytics-realization-sort-toggle
                style="border:0;background:transparent;padding:0;font-size:.82rem;font-weight:620;color:var(--muted);cursor:pointer;text-decoration:underline;"
              >
                Sort: ${escapeHtml(
                  REALIZATION_SORT_OPTIONS.find((item) => item.id === uiState.realizationSort)?.name || "High → Low"
                )}
              </button>
            </div>
            ${
              isCompletedLayer
                ? '<div data-analytics-realization-primary-host></div>'
                : '<div class="analytics-chart-empty">In-progress realization coming soon</div>'
            }
          </section>

          <section class="analytics-chart-wrap">
            <div class="analytics-chart-head">
              <strong>${escapeHtml(selectedRow ? `${selectedRow.name} Monthly Realization` : "Monthly Realization Trend")}</strong>
            </div>
            ${
              isCompletedLayer
                ? '<div data-analytics-realization-trend-host></div>'
                : '<div class="analytics-chart-empty">In-progress realization coming soon</div>'
            }
          </section>
        </div>
      `;
      bindAnalyticsSubTabEvents(body, uiState, options);
      const realizationControls = body.querySelector("[data-analytics-realization-controls]");
      if (realizationControls) {
        realizationControls.addEventListener("click", (event) => {
          const button = event.target.closest("[data-analytics-realization-layer]");
          if (!button || button.disabled) return;
          const nextLayer = normalizeRealizationLayer(button.dataset.analyticsRealizationLayer);
          if (nextLayer === uiState.realizationLayer) return;
          uiState.realizationLayer = nextLayer;
          renderAnalyticsPage(options);
        });
        realizationControls.addEventListener("change", () => {
          uiState.realizationPeriod = normalizeRealizationPeriod(realizationControls.elements.realizationPeriod?.value);
          uiState.realizationOfficeId = safeText(realizationControls.elements.realizationOfficeId?.value);
          uiState.realizationDepartmentId = safeText(realizationControls.elements.realizationDepartmentId?.value);
          renderAnalyticsPage(options);
        });
      }
      const realizationGroupBy = body.querySelector("[data-analytics-realization-groupby]");
      if (realizationGroupBy) {
        realizationGroupBy.addEventListener("change", () => {
          uiState.realizationGroupBy = normalizeRealizationGroupBy(realizationGroupBy.value);
          renderAnalyticsPage(options);
        });
      }
      const realizationSortToggle = body.querySelector("[data-analytics-realization-sort-toggle]");
      if (realizationSortToggle) {
        realizationSortToggle.addEventListener("click", () => {
          uiState.realizationSort = nextRealizationSort(uiState.realizationSort);
          renderAnalyticsPage(options);
        });
      }
      if (isCompletedLayer) {
        renderRealizationPrimaryChart({
          container: body.querySelector("[data-analytics-realization-primary-host]"),
          rows: realizationRows,
          groupByLabel,
          selectedKey: uiState.realizationSelectedKey,
          onSelect: (nextKey) => {
            uiState.realizationSelectedKey = safeText(nextKey);
            renderAnalyticsPage(options);
          },
        });
        renderRealizationTrendChart({
          container: body.querySelector("[data-analytics-realization-trend-host]"),
          seriesRows: selectedSeries,
        });
      }
      return;
    }

    if (uiState.activeTab === ANALYTICS_SUB_TAB_UTILIZATION) {
      uiState.utilizationPeriod = normalizeUtilizationPeriod(uiState.utilizationPeriod);
      uiState.utilizationGroupBy = normalizeUtilizationGroupBy(uiState.utilizationGroupBy);
      uiState.utilizationMemberSort = normalizeUtilizationMemberSort(uiState.utilizationMemberSort);
      uiState.utilizationMemberTitle = normalizeUtilizationMemberTitle(uiState.utilizationMemberTitle);

      const scopeOptions = typeof engine.listUtilizationScopeOptions === "function"
        ? engine.listUtilizationScopeOptions({
            currentUser: appState.currentUser,
            utilizationScope: appState.utilizationScope,
            users: utilizationData.users,
            offices: appState.officeLocations,
            departments: appState.departments,
            levelLabels: appState.levelLabels,
            departmentLeadAssignments: appState.departmentLeadAssignments,
          })
        : engine.listScopeOptions({
            offices: appState.officeLocations,
            departments: appState.departments,
          });
      const utilizationScope = scopeOptions?.scope || appState?.utilizationScope || {};
      const scopeType = safeText(utilizationScope?.type).toLowerCase();
      const isSelfOnlyScope = scopeType === "self";
      const isAdminOfficeScope = scopeType === "office";
      const isDepartmentHeadScope = scopeType === "office_department";
      if (isSelfOnlyScope) {
        uiState.utilizationGroupBy = "member";
        uiState.utilizationOfficeId = "";
        uiState.utilizationDepartmentId = "";
      }

      const periodRange = utilizationPeriodRange(uiState.utilizationPeriod, new Date());
      const allowedOfficeIds = new Set((scopeOptions.offices || []).map((item) => safeText(item?.id)).filter(Boolean));
      const allowedDepartmentIds = new Set(
        (scopeOptions.departments || []).map((item) => safeText(item?.id)).filter(Boolean)
      );
      if (uiState.utilizationOfficeId && !allowedOfficeIds.has(uiState.utilizationOfficeId)) {
        uiState.utilizationOfficeId = "";
      }
      if (uiState.utilizationDepartmentId && !allowedDepartmentIds.has(uiState.utilizationDepartmentId)) {
        uiState.utilizationDepartmentId = "";
      }
      if (isAdminOfficeScope) {
        const scopedOfficeId = safeText(utilizationScope?.officeId);
        if (scopedOfficeId) {
          uiState.utilizationOfficeId = scopedOfficeId;
        }
      }
      if (isDepartmentHeadScope) {
        const scopedOfficeId = safeText(utilizationScope?.officeId);
        const scopedDepartmentId = safeText(utilizationScope?.departmentId);
        if (scopedOfficeId) {
          uiState.utilizationOfficeId = scopedOfficeId;
        }
        if (scopedDepartmentId) {
          uiState.utilizationDepartmentId = scopedDepartmentId;
        }
      }
      const utilizationGroupByOptions = isDepartmentHeadScope
        ? UTILIZATION_GROUP_BY_OPTIONS.filter((item) => {
            const id = safeText(item?.id);
            return id !== "office" && id !== "department";
          })
        : isAdminOfficeScope
          ? UTILIZATION_GROUP_BY_OPTIONS.filter((item) => safeText(item?.id) !== "office")
          : UTILIZATION_GROUP_BY_OPTIONS;
      if (!utilizationGroupByOptions.some((item) => item.id === uiState.utilizationGroupBy)) {
        uiState.utilizationGroupBy = "member";
      }
      const groupByLabel =
        utilizationGroupByOptions.find((item) => item.id === uiState.utilizationGroupBy)?.name || "Group";
      const utilization = engine.computeUtilizationAnalytics({
        entries: utilizationData.entries,
        users: utilizationData.users,
        currentUser: appState.currentUser,
        utilizationScope: appState.utilizationScope,
        departmentLeadAssignments: appState.departmentLeadAssignments,
        projects: utilizationData.projects,
        clients: utilizationData.clients,
        offices: appState.officeLocations,
        departments: appState.departments,
        corporateFunctionCategories: appState.corporateFunctionCategories,
        levelLabels: appState.levelLabels,
        filters: {
          fromDate: periodRange.fromDate,
          toDate: periodRange.toDate,
          period: uiState.utilizationPeriod,
          groupBy: uiState.utilizationGroupBy,
          officeId: uiState.utilizationOfficeId,
          departmentId: uiState.utilizationDepartmentId,
        },
      });
      const rawUtilizationRows = Array.isArray(utilization?.rows) ? utilization.rows : [];
      const isMemberGrouping = uiState.utilizationGroupBy === "member";
      const memberTitleIndex = memberTitleByRowKey(rawUtilizationRows);
      const memberTitleOptions = [
        { id: UTILIZATION_MEMBER_TITLE_ALL, name: "All Titles" },
        ...Array.from(
          new Set(
            rawUtilizationRows
              .map((row) => memberTitleIndex.get(safeText(row?.key)) || "Unassigned")
              .filter(Boolean)
          )
        )
          .sort((a, b) => a.localeCompare(b))
          .map((title) => ({ id: title, name: title })),
      ];
      if (
        isMemberGrouping &&
        uiState.utilizationMemberTitle !== UTILIZATION_MEMBER_TITLE_ALL &&
        !memberTitleOptions.some((item) => item.id === uiState.utilizationMemberTitle)
      ) {
        uiState.utilizationMemberTitle = UTILIZATION_MEMBER_TITLE_ALL;
      }
      const titleFilteredRows = filterUtilizationRowsByMemberTitle(
        rawUtilizationRows.map((row) => ({
          ...row,
          memberTitle: memberTitleIndex.get(safeText(row?.key)) || memberTitleLabel(row),
        })),
        uiState.utilizationGroupBy,
        uiState.utilizationMemberTitle
      );
      const utilizationRows = sortUtilizationRowsForUi(
        titleFilteredRows,
        uiState.utilizationGroupBy,
        uiState.utilizationMemberSort
      );
      const showMemberSortControl = isMemberGrouping && !isSelfOnlyScope;
      const availableKeys = new Set(utilizationRows.map((row) => safeText(row?.key)).filter(Boolean));
      const preferredSelectedKey = safeText(uiState.utilizationSelectedKey);
      if (!preferredSelectedKey || !availableKeys.has(preferredSelectedKey)) {
        uiState.utilizationSelectedKey = safeText(utilizationRows[0]?.key);
      }
      const selectedRow =
        utilizationRows.find((row) => safeText(row?.key) === safeText(uiState.utilizationSelectedKey)) || null;
      const selectedSeries = selectedRow
        ? Array.isArray(utilization?.timeSeriesByKey?.[selectedRow.key])
          ? utilization.timeSeriesByKey[selectedRow.key]
          : []
        : [];
      const groupByControlHtml = isSelfOnlyScope
        ? ""
        : `<label>
              <span>Group By</span>
              <span class="analytics-util-select-wrap">
                <select name="groupBy" class="analytics-util-select">${renderOptions(
                  utilizationGroupByOptions,
                  uiState.utilizationGroupBy
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>`;
      const adminOfficeName = isAdminOfficeScope
        ? safeText((scopeOptions.offices || [])[0]?.name || utilizationScope?.officeName || "")
        : "";
      const departmentHeadOfficeName = isDepartmentHeadScope
        ? safeText((scopeOptions.offices || [])[0]?.name || utilizationScope?.officeName || "")
        : "";
      const departmentHeadDepartmentName = isDepartmentHeadScope
        ? safeText((scopeOptions.departments || [])[0]?.name || utilizationScope?.departmentName || "")
        : "";
      const officeControlHtml = isSelfOnlyScope
        ? ""
        : (isAdminOfficeScope || isDepartmentHeadScope)
          ? `<label>
              <span>Office</span>
              <div class="analytics-util-select" style="display:flex;align-items:center;min-height:34px;padding:0 10px;background:#fff;border:1px solid var(--line);border-radius:8px;">${escapeHtml(
                (isDepartmentHeadScope ? departmentHeadOfficeName : adminOfficeName) || "Assigned office"
              )}</div>
            </label>`
        : `<label>
              <span>Office</span>
              <span class="analytics-util-select-wrap">
                <select name="officeId" class="analytics-util-select">${renderOptions(
                  scopeOptions.offices,
                  uiState.utilizationOfficeId,
                  "All"
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>`;
      const departmentControlHtml = isSelfOnlyScope
        ? ""
        : isDepartmentHeadScope
          ? `<label>
              <span>Department</span>
              <div class="analytics-util-select" style="display:flex;align-items:center;min-height:34px;padding:0 10px;background:#fff;border:1px solid var(--line);border-radius:8px;">${escapeHtml(
                departmentHeadDepartmentName || "Assigned department"
              )}</div>
            </label>`
        : `<label>
              <span>Department</span>
              <span class="analytics-util-select-wrap">
                <select name="departmentId" class="analytics-util-select">${renderOptions(
                  scopeOptions.departments,
                  uiState.utilizationDepartmentId,
                  "All"
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>`;
      const utilizationMainHtml = isSelfOnlyScope
        ? `
          <section class="analytics-chart-wrap">
            <div class="analytics-chart-head">
              <strong>${escapeHtml(selectedRow ? `${selectedRow.name} Utilization Over Time` : "My Utilization Over Time")}</strong>
            </div>
            <div data-analytics-utilization-right-host></div>
          </section>
        `
        : `
          <section class="analytics-util-grid">
            <article class="analytics-util-card">
              <div class="analytics-chart-head">
                ${
                  showMemberSortControl
                    ? `<span style="display:inline-flex;align-items:center;gap:8px;min-width:0;">
                        <strong>Members:</strong>
                        <span class="analytics-member-title-wrap" style="max-width:200px;">
                          <select name="memberTitle" data-analytics-member-title class="analytics-member-title-select" style="max-width:200px;">
                            ${renderOptions(memberTitleOptions, uiState.utilizationMemberTitle)}
                          </select>
                          <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
                        </span>
                      </span>`
                    : `<strong>Current Utilization by ${escapeHtml(groupByLabel)}</strong>`
                }
                ${
                  showMemberSortControl
                    ? `<button
                        type="button"
                        data-analytics-member-sort-toggle
                        style="border:0;background:transparent;padding:0;font-size:.82rem;font-weight:620;color:var(--muted);cursor:pointer;text-decoration:underline;"
                      >
                        Sort: ${escapeHtml(
                          UTILIZATION_MEMBER_SORT_OPTIONS.find((item) => item.id === uiState.utilizationMemberSort)?.name ||
                            "High → Low"
                        )}
                      </button>`
                    : ""
                }
              </div>
              <div class="analytics-util-left-scroll">
                <div data-analytics-utilization-left-host></div>
              </div>
            </article>
            <article class="analytics-util-card">
              <div class="analytics-chart-head">
                <strong>${escapeHtml(selectedRow ? `${selectedRow.name} Over Time` : "Utilization Over Time")}</strong>
              </div>
              <div data-analytics-utilization-right-host></div>
            </article>
          </section>
        `;

      body.innerHTML = `
        <div class="analytics-panel" data-analytics-root>
          ${subTabsHtml}

          <form class="analytics-util-filters" data-analytics-utilization-filters>
            <label>
              <span>Period</span>
              <span class="analytics-util-select-wrap">
                <select name="period" class="analytics-util-select">${renderOptions(
                  UTILIZATION_PERIODS,
                  uiState.utilizationPeriod
                )}</select>
                <span class="analytics-member-title-chevron" aria-hidden="true">▾</span>
              </span>
            </label>
            ${groupByControlHtml}
            ${officeControlHtml}
            ${departmentControlHtml}
          </form>

          <section class="analytics-kpis">
            <article class="analytics-kpi"><div class="analytics-kpi-label">Avg Utilization %</div><div class="analytics-kpi-value">${escapeHtml(
              formatPercent(utilization.kpis.avgUtilizationPct)
            )}</div></article>
            <article class="analytics-kpi"><div class="analytics-kpi-label">Client Hours</div><div class="analytics-kpi-value">${escapeHtml(
              formatHours(utilization.kpis.clientHours)
            )}</div></article>
            <article class="analytics-kpi"><div class="analytics-kpi-label">Internal Hours</div><div class="analytics-kpi-value">${escapeHtml(
              formatHours(utilization.kpis.internalHours)
            )}</div></article>
            <article class="analytics-kpi"><div class="analytics-kpi-label">PTO Hours</div><div class="analytics-kpi-value">${escapeHtml(
              formatHours(utilization.kpis.ptoHours)
            )}</div></article>
            <article class="analytics-kpi"><div class="analytics-kpi-label">Idle Hours</div><div class="analytics-kpi-value">${escapeHtml(
              formatHours(utilization.kpis.idleHours)
            )}</div></article>
          </section>

          <section class="analytics-util-shared-legend" aria-label="Utilization legend">
            <span class="analytics-util-legend-item"><span class="analytics-util-legend-swatch" style="background:#2f9988;"></span>Client</span>
            <span class="analytics-util-legend-item"><span class="analytics-util-legend-swatch" style="background:#2f6fed;"></span>Internal</span>
            <span class="analytics-util-legend-item"><span class="analytics-util-legend-swatch" style="background:#9a78d1;"></span>PTO</span>
            <span class="analytics-util-legend-item"><span class="analytics-util-legend-swatch" style="background:#b8bdc7;"></span>Idle</span>
          </section>

          ${utilizationMainHtml}

          <p class="analytics-footnote">${escapeHtml(utilization.assumptions.capacity)}</p>
          <p class="analytics-footnote">${escapeHtml(utilization.assumptions.categoryMapping)}</p>
        </div>
      `;

      bindAnalyticsSubTabEvents(body, uiState, options);
      const utilizationFilterForm = body.querySelector("[data-analytics-utilization-filters]");
      if (utilizationFilterForm) {
        utilizationFilterForm.addEventListener("change", () => {
          uiState.utilizationPeriod = normalizeUtilizationPeriod(utilizationFilterForm.elements.period?.value);
          if (!isSelfOnlyScope) {
            uiState.utilizationGroupBy = normalizeUtilizationGroupBy(utilizationFilterForm.elements.groupBy?.value);
            if (utilizationFilterForm.elements.officeId) {
              uiState.utilizationOfficeId = safeText(utilizationFilterForm.elements.officeId?.value);
            } else if (isAdminOfficeScope || isDepartmentHeadScope) {
              uiState.utilizationOfficeId = safeText(utilizationScope?.officeId);
            }
            if (utilizationFilterForm.elements.departmentId) {
              uiState.utilizationDepartmentId = safeText(utilizationFilterForm.elements.departmentId?.value);
            } else if (isDepartmentHeadScope) {
              uiState.utilizationDepartmentId = safeText(utilizationScope?.departmentId);
            }
          }
          renderAnalyticsPage(options);
        });
      }
      if (!isSelfOnlyScope) {
        const memberSortToggle = body.querySelector("[data-analytics-member-sort-toggle]");
        if (memberSortToggle) {
          memberSortToggle.addEventListener("click", () => {
            uiState.utilizationMemberSort = nextUtilizationMemberSort(uiState.utilizationMemberSort);
            renderAnalyticsPage(options);
          });
        }
        const memberTitleSelect = body.querySelector("[data-analytics-member-title]");
        if (memberTitleSelect) {
          memberTitleSelect.addEventListener("change", () => {
            uiState.utilizationMemberTitle = normalizeUtilizationMemberTitle(memberTitleSelect.value);
            renderAnalyticsPage(options);
          });
        }
        renderUtilizationOverviewChart({
          container: body.querySelector("[data-analytics-utilization-left-host]"),
          rows: utilizationRows,
          groupByLabel,
          selectedKey: uiState.utilizationSelectedKey,
          onSelect: (nextKey) => {
            uiState.utilizationSelectedKey = safeText(nextKey);
            renderAnalyticsPage(options);
          },
        });
      }
      renderUtilizationDetailChart({
        container: body.querySelector("[data-analytics-utilization-right-host]"),
        seriesRows: selectedSeries,
      });
      return;
    }

    const scopeOptions = engine.listScopeOptions({
      offices: appState.officeLocations,
      departments: appState.departments,
    });
    const clientProjectOptions = engine.listClientProjectOptions({
      clients: profitabilityData.clients,
      projects: profitabilityData.projects,
    });

    const selectedClientId = uiState.clientId;
    const projectItems = selectedClientId
      ? clientProjectOptions.projectsByClient.get(selectedClientId) || []
      : [];

    const computed = engine.computeAnalytics({
      entries: profitabilityData.entries,
      expenses: profitabilityData.expenses,
      users: appState.users,
      projects: profitabilityData.projects,
      clients: profitabilityData.clients,
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
