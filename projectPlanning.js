(function () {
  const STYLE_ID = "project-planning-page-style";
  const PROJECT_PLANNING_DELETE_ICON = `
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" fill="currentColor"/>
    </svg>
  `;

  function ensurePlanningStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .project-planning-page {
        display: grid;
        gap: 16px;
      }
      .project-planning-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        flex-wrap: wrap;
      }
      .project-planning-head-main {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex-wrap: wrap;
      }
      .project-planning-head h2 {
        margin: 0;
      }
      .project-planning-subtitle {
        margin: 0;
        color: var(--text);
        font-size: 1.28rem;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .project-planning-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .project-planning-kpi-row {
        width: 100%;
        margin-bottom: 14px;
      }
      .project-planning-contract-type-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0;
        border: 1px solid var(--line);
        border-radius: 9px;
        overflow: hidden;
        background: transparent;
      }
      .project-planning-contract-type-option {
        height: 36px;
        min-height: 36px;
        border: 0;
        border-right: 1px solid var(--line);
        background: transparent;
        color: var(--muted);
        padding: 0 14px;
        font-size: 0.86rem;
        font-weight: 600;
        cursor: pointer;
        line-height: 1;
      }
      .project-planning-contract-type-option:last-child {
        border-right: 0;
      }
      .project-planning-contract-type-option.is-active {
        background: color-mix(in srgb, var(--accent) 86%, white 14%);
        color: #fff;
        border-right-color: color-mix(in srgb, var(--accent) 86%, white 14%);
        font-weight: 600;
        box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.14);
      }
      .project-planning-page .button {
        min-height: 36px;
        height: 36px;
        border-radius: 9px;
        padding-top: 0;
        padding-bottom: 0;
      }
      .project-planning-page .button.button-ghost {
        min-height: 36px;
        height: 36px;
        border-radius: 9px;
      }
      .project-planning-layout {
        display: grid;
        grid-template-columns: minmax(0, 73%) minmax(0, 27%);
        gap: 12px;
        align-items: stretch;
      }
      .project-planning-layout > main {
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .project-planning-body {
        height: calc(100vh - 320px);
        min-height: 460px;
      }
      .project-planning-block {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface);
        padding: 14px;
      }
      .project-planning-block h3 {
        margin: 0 0 10px;
      }
      .project-planning-kpis {
        display: grid;
        grid-template-columns: 1.23fr 2fr 2fr 2fr;
        gap: 12px;
        margin-bottom: 0;
      }
      .project-planning-kpi {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 11px 14px;
        background: var(--surface);
      }
      .project-planning-kpi-label {
        color: var(--muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: .06em;
        font-weight: 600;
      }
      .project-planning-kpi-value {
        margin-top: 6px;
        font-size: 1.62rem;
        font-weight: 750;
        line-height: 1.2;
      }
      .project-planning-kpi.is-emphasis .project-planning-kpi-value {
        font-size: 1.68rem;
        font-weight: 800;
      }
      .project-planning-kpi-sub {
        margin-top: 6px;
        display: grid;
        gap: 3px;
      }
      .project-planning-kpi-subline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 0.79rem;
        line-height: 1.25;
        font-variant-numeric: tabular-nums;
      }
      .project-planning-kpi-subline strong {
        color: var(--text);
        font-weight: 600;
      }
      .project-planning-kpi-subline.is-positive strong {
        color: var(--success);
      }
      .project-planning-kpi-subline.is-negative strong {
        color: var(--danger);
      }
      .project-planning-kpi-edit-input {
        width: 100%;
        margin-top: 6px;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 1.58rem;
        font-weight: 700;
        line-height: 1.2;
      }
      .project-planning-econ-edit-input {
        width: 128px;
        min-width: 128px;
        max-width: 128px;
        margin-top: 0;
        padding: 4px 8px;
        border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
        border-radius: 6px;
        background: color-mix(in srgb, var(--surface-strong) 88%, var(--surface));
        font-size: 0.95rem;
        font-weight: 600;
        text-align: right;
      }
      .project-planning-econ-edit-display {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .project-planning-econ-edit-display .project-planning-econ-edit-trigger {
        color: #2ea86a;
        font-size: 13px;
        line-height: 1;
      }
      .project-planning-econ-edit-display .project-planning-econ-edit-value {
        font-variant-numeric: tabular-nums;
      }
      [data-econ="revenuePrimary"] {
        justify-self: end;
        display: inline-flex;
        justify-content: flex-end;
        align-items: center;
      }
      [data-econ-label="revenuePrimary"] {
        white-space: nowrap;
      }
      .project-planning-econ-value.is-editable {
        cursor: text;
      }
      .project-planning-field {
        display: grid;
        gap: 4px;
      }
      .project-planning-field-label {
        color: var(--muted);
        font-size: .78rem;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .project-planning-field-value {
        font-weight: 600;
      }
      .project-planning-table-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        flex: 1;
      }
      .project-planning-table-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0 0 10px;
      }
      .project-planning-table-head-main {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .project-planning-table-head h3 {
        margin: 0;
      }
      .project-planning-table-wrap {
        flex: 1;
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: auto;
      }
      .project-planning-table-panels {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .project-planning-table-panels > [data-planning-tab-panel] {
        flex: 1;
        min-height: 0;
      }
      .project-planning-expenses-panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .project-planning-expenses-actions {
        display: flex;
        justify-content: flex-end;
      }
      .project-planning-table {
        width: 100%;
        border-collapse: collapse;
      }
      .project-planning-table th,
      .project-planning-table td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .project-planning-table th {
        color: var(--muted);
        font-size: .76rem;
        text-transform: uppercase;
        letter-spacing: .04em;
        position: sticky;
        top: 0;
        background: var(--surface);
        z-index: 2;
      }
      .project-planning-table th:nth-child(6),
      .project-planning-table th:nth-child(7),
      .project-planning-table td:nth-child(6),
      .project-planning-table td:nth-child(7) {
        text-align: right;
      }
      .project-planning-right {
        display: grid;
        gap: 6px;
        padding-top: 0;
        height: 100%;
        min-height: 0;
      }
      .project-planning-economics h4 {
        margin: 0;
      }
      .project-planning-economics {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        min-height: 0;
      }
      .project-planning-econ-section {
        display: grid;
        gap: 6px;
      }
      .project-planning-econ-section + .project-planning-econ-section {
        margin-top: 8px;
        padding-top: 10px;
        border-top: 1px solid var(--line);
      }
      .project-planning-econ-title {
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: .04em;
        font-weight: 700;
      }
      .project-planning-econ-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
      }
      .project-planning-econ-label {
        color: var(--text);
      }
      .project-planning-econ-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .project-planning-econ-value.is-negative {
        color: var(--danger);
      }
      .project-planning-econ-value.is-positive {
        color: var(--success);
      }
      .project-planning-placeholder {
        color: var(--muted);
        font-size: .9rem;
      }
      .project-planning-input {
        width: 100%;
        min-width: 74px;
      }
      .project-planning-table .table-numeric {
        text-align: right;
      }
      .project-planning-table-card .project-planning-table .table-input {
        text-align: right;
        background: color-mix(in srgb, var(--surface-strong) 82%, var(--surface));
        border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
      }
      .project-planning-table .table-output {
        color: color-mix(in srgb, var(--text) 86%, var(--muted) 14%);
      }
      .project-planning-table .table-actions {
        width: 1%;
        text-align: right;
      }
      .project-planning-row-delete {
        border: 0;
        background: transparent;
        color: var(--danger);
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .project-planning-row-delete svg {
        width: 18px;
        height: 18px;
      }
      .project-planning-row-delete:hover,
      .project-planning-row-delete:focus-visible {
        background: color-mix(in srgb, var(--danger) 10%, transparent);
      }
      .project-planning-row-delete[disabled] {
        opacity: 0.35;
        cursor: default;
      }
      .project-planning-table tr.table-row-surface td {
        background: color-mix(in srgb, var(--surface-strong) 72%, var(--surface));
        border-bottom-color: color-mix(in srgb, var(--line) 62%, transparent);
      }
      .project-planning-table input[data-row-input="chargeRate"],
      .project-planning-table input[data-row-input="hours"] {
        max-width: 96px;
      }
      .project-planning-table input[data-row-input="chargeRate"]::-webkit-outer-spin-button,
      .project-planning-table input[data-row-input="chargeRate"]::-webkit-inner-spin-button,
      .project-planning-table input[data-row-input="hours"]::-webkit-outer-spin-button,
      .project-planning-table input[data-row-input="hours"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .project-planning-table input[data-row-input="chargeRate"],
      .project-planning-table input[data-row-input="hours"] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
      .project-planning-table input[data-expense-input="units"],
      .project-planning-table input[data-expense-input="unitCost"],
      .project-planning-table input[data-expense-input="markupPct"] {
        max-width: 110px;
      }
      .project-planning-table input[data-expense-input="units"]::-webkit-outer-spin-button,
      .project-planning-table input[data-expense-input="units"]::-webkit-inner-spin-button,
      .project-planning-table input[data-expense-input="unitCost"]::-webkit-outer-spin-button,
      .project-planning-table input[data-expense-input="unitCost"]::-webkit-inner-spin-button,
      .project-planning-table input[data-expense-input="markupPct"]::-webkit-outer-spin-button,
      .project-planning-table input[data-expense-input="markupPct"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .project-planning-table input[data-expense-input="units"],
      .project-planning-table input[data-expense-input="unitCost"],
      .project-planning-table input[data-expense-input="markupPct"] {
        -moz-appearance: textfield;
        appearance: textfield;
      }
      .project-planning-expenses-panel .project-planning-table input[data-expense-input="description"] {
        text-align: left;
      }
      .project-planning-expenses-panel .project-planning-table {
        table-layout: fixed;
      }
      .project-planning-expenses-panel .project-planning-table col.exp-col-category { width: 15%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-description { width: 31%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-units { width: 8%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-unit-cost { width: 10%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-markup { width: 10%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-total { width: 10%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-billable { width: 11%; }
      .project-planning-expenses-panel .project-planning-table col.exp-col-actions { width: 5%; }
      .project-planning-expenses-panel .project-planning-table th,
      .project-planning-expenses-panel .project-planning-table td {
        padding: 6px 4px;
      }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table th,
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table td {
        padding: 6px 4px;
      }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table {
        table-layout: fixed;
      }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-member { width: 19%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-role { width: 17%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-cost-rate { width: 12%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-charge-rate { width: 15%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-hours { width: 14%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-cost { width: 10%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-revenue { width: 10%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table col.time-col-actions { width: 3%; }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table th:nth-child(3),
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table th:nth-child(4),
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table th:nth-child(5),
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table th:nth-child(6),
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table th:nth-child(7) {
        text-align: right;
      }
      .project-planning-expenses-panel .project-planning-input {
        min-width: 0;
      }
      .project-planning-expenses-panel .project-planning-table .table-input {
        display: block;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        padding: 6px 8px;
      }
      .project-planning-table-panels [data-planning-tab-panel="time"] .project-planning-table .table-input {
        padding: 6px 8px;
      }
      .project-planning-expenses-panel .project-planning-table td {
        overflow: hidden;
      }
      .project-planning-expenses-panel .project-planning-table th:nth-child(6),
      .project-planning-expenses-panel .project-planning-table td:nth-child(6) {
        text-align: right;
      }
      .project-planning-expenses-panel .project-planning-table th:nth-child(7),
      .project-planning-expenses-panel .project-planning-table td:nth-child(7) {
        text-align: center;
      }
      .project-planning-expenses-panel .project-planning-table th:nth-child(8),
      .project-planning-expenses-panel .project-planning-table td:nth-child(8) {
        text-align: right;
      }
      .project-planning-table .perm-switch{
        position:relative;
        display:inline-flex;
        width:42px;
        height:24px;
        vertical-align:middle;
      }
      .project-planning-table .perm-switch input{
        position:absolute;
        width:1px;
        height:1px;
        opacity:0;
        pointer-events:none;
      }
      .project-planning-table .perm-switch-track{
        width:100%;
        height:100%;
        border-radius:999px;
        border:1px solid var(--line);
        background:color-mix(in srgb, var(--danger) 10%, var(--surface));
        position:relative;
        transition:background 140ms ease,border-color 140ms ease,opacity 140ms ease;
      }
      .project-planning-table .perm-switch-track::after{
        content:"";
        position:absolute;
        top:2px;
        left:2px;
        width:18px;
        height:18px;
        border-radius:50%;
        background:var(--ink);
        opacity:.45;
        transition:transform 140ms ease,opacity 140ms ease,background 140ms ease;
      }
      .project-planning-table .perm-switch input:checked + .perm-switch-track{
        background:color-mix(in srgb, #39a96b 20%, var(--surface));
        border-color:color-mix(in srgb, #39a96b 55%, var(--line));
      }
      .project-planning-table .perm-switch input:checked + .perm-switch-track::after{
        transform:translateX(18px);
        opacity:1;
        background:#2f9d57;
      }
      @media (max-width: 1200px) {
        .project-planning-layout {
          grid-template-columns: 1fr;
        }
        .project-planning-body {
          height: auto;
          min-height: 0;
        }
        .project-planning-kpis {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 900px) {
        .project-planning-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  function fmtMoneyZero(value) {
    const num = Number(value);
    const safe = Number.isFinite(num) ? num : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safe);
  }

  function fmtPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(num)}%`;
  }

  function fmtPercentZero(value) {
    const num = Number(value);
    const safe = Number.isFinite(num) ? num : 0;
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(safe)}%`;
  }

  function fmtHours(value) {
    const num = Number(value);
    const safe = Number.isFinite(num) ? num : 0;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safe);
  }

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toNumberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function computeRows(rows) {
    return rows.map((row) => {
      const hours = toNumberOrZero(row.hours);
      const costRate = toNumberOrZero(row.costRate);
      const chargeRate = toNumberOrZero(row.chargeRate);
      const baseRate = Number.isFinite(Number(row.baseRate))
        ? Number(row.baseRate)
        : chargeRate;
      const plannedCost = costRate * hours;
      const plannedRevenue = chargeRate * hours;
      const standardRevenue = baseRate * hours;
      const margin = plannedRevenue - plannedCost;
      const marginPercent = plannedRevenue > 0 ? (margin / plannedRevenue) * 100 : 0;
      return {
        ...row,
        hours,
        costRate,
        chargeRate,
        baseRate,
        plannedCost,
        plannedRevenue,
        standardRevenue,
        margin,
        marginPercent,
      };
    });
  }

  function computeTotals(rows, contractAmount, overheadPercent) {
    const totalHours = rows.reduce((sum, row) => sum + toNumberOrZero(row.hours), 0);
    const directCost = rows.reduce((sum, row) => sum + toNumberOrZero(row.plannedCost), 0);
    const plannedRevenueTotal = rows.reduce((sum, row) => sum + toNumberOrZero(row.plannedRevenue), 0);
    const standardRevenueTotal = rows.reduce((sum, row) => sum + toNumberOrZero(row.standardRevenue), 0);
    const overheadRate = toNumberOrZero(overheadPercent) / 100;
    const overheadCost = directCost * overheadRate;
    const totalCost = directCost + overheadCost;
    const hasContract = Number.isFinite(contractAmount);
    const grossMargin = hasContract ? contractAmount - totalCost : null;
    const marginPercent = hasContract && contractAmount > 0 ? (grossMargin / contractAmount) * 100 : null;
    return {
      totalHours,
      directCost,
      plannedRevenueTotal,
      standardRevenueTotal,
      overheadCost,
      totalCost,
      grossMargin,
      marginPercent,
      hasContract,
    };
  }

  function computeExpenseTotals(rows) {
    const source = Array.isArray(rows) ? rows : [];
    let expenseCost = 0;
    let expenseRevenue = 0;
    source.forEach((row) => {
      const units = toNumberOrZero(row?.units);
      const unitCost = toNumberOrZero(row?.unitCost);
      const markupPct = toNumberOrZero(row?.markupPct);
      const rowCost = units * unitCost;
      const rowRevenue = row?.billable === true ? rowCost * (1 + markupPct / 100) : 0;
      expenseCost += rowCost;
      expenseRevenue += rowRevenue;
    });
    return { expenseCost, expenseRevenue };
  }

  function renderProjectPlanningPage({
    projectId,
    state,
    container,
    onBack,
    onSave,
    onAddMember,
    onPersistField,
    onDeleteMember,
    onPersistContractType,
    onPersistContractAmount,
    onCreateExpenseRow,
    onPersistExpenseField,
    onDeleteExpenseRow,
  }) {
    ensurePlanningStyles();
    if (!container) return;

    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const targetId = String(projectId || "").trim();
    const project =
      projects.find((item) => String(item?.id || "").trim() === targetId) ||
      null;
    const projectIdKey = String(project?.id || "").trim();
    if (!project || !projectIdKey) {
      container.innerHTML = `
        <section class="page-view project-planning-page" aria-labelledby="project-planning-title">
          <header class="project-planning-head">
            <div>
              <h2 id="project-planning-title">Project Planning</h2>
              <p class="project-planning-subtitle">Project context unavailable</p>
            </div>
            <div class="project-planning-actions">
              <button type="button" class="button button-ghost" data-project-planning-back>Back</button>
            </div>
          </header>
          <section class="project-planning-block">
            <p class="project-planning-placeholder">Select a project from the Clients page, then open Project Planning again.</p>
          </section>
        </section>
      `;
      container.querySelector("[data-project-planning-back]")?.addEventListener("click", () => {
        if (typeof onBack === "function") onBack();
      });
      return;
    }
    const projectMemberAssignments = Array.isArray(state?.assignments?.projectMembers)
      ? state.assignments.projectMembers.filter(
          (row) => String(row?.projectId || "").trim() === projectIdKey
        )
      : [];
    const managerAssignments = Array.isArray(state?.assignments?.managerProjects)
      ? state.assignments.managerProjects.filter(
          (row) => String(row?.projectId || "").trim() === projectIdKey
        )
      : [];
    const usersById = new Map((state?.users || []).map((u) => [String(u?.id || "").trim(), u]));

    const clientName = String(project?.client || "Unknown client");
    const projectName = String(project?.name || "Select a project");
    const subtitle = `${clientName} / ${projectName}`;
    const leadName = String(
      project?.projectLeadName ||
        usersById.get(String(project?.projectLeadId || project?.project_lead_id || "").trim())?.displayName ||
        "Unassigned"
    );
    const overheadValue = toNullableNumber(project?.overheadPercent ?? project?.overhead_percent);
    let contractAmountValue = toNullableNumber(project?.contractAmount ?? project?.contract_amount);
    const pricingModel = String(project?.pricingModel ?? project?.pricing_model ?? "").trim().toLowerCase();
    let contractType = pricingModel === "time_and_materials" ? "tm" : "fixed";
    let activePlanningTab = "time";
    let planningExpenseRows = [];
    const memberBudgets = Array.isArray(state?.projectMemberBudgets)
      ? state.projectMemberBudgets.filter(
          (row) => String(row?.projectId || "").trim() === String(project?.id || "").trim()
      )
      : [];
    const budgetByUserId = new Map(
      memberBudgets.map((row) => [String(row?.userId || "").trim(), row])
    );
    const levelLabelMap = state?.levelLabels && typeof state.levelLabels === "object"
      ? state.levelLabels
      : {};
    const leadUserId = String(project?.projectLeadId || project?.project_lead_id || "").trim();
    const managerIds = new Set(
      managerAssignments.map((row) => String(row?.managerId || "").trim()).filter(Boolean)
    );
    const allAssignedUserIds = [];
    if (leadUserId) allAssignedUserIds.push(leadUserId);
    managerIds.forEach((id) => allAssignedUserIds.push(id));
    projectMemberAssignments.forEach((row) => {
      const id = String(row?.userId || "").trim();
      if (id) allAssignedUserIds.push(id);
    });
    const dedupedUserIds = Array.from(new Set(allAssignedUserIds));
    const managerAssignmentByUser = new Map(
      managerAssignments.map((row) => [String(row?.managerId || "").trim(), row])
    );
    const memberAssignmentByUser = new Map(
      projectMemberAssignments.map((row) => [String(row?.userId || "").trim(), row])
    );
    const projectExpenseCategories = Array.isArray(state?.projectExpenseCategories)
      ? state.projectExpenseCategories
          .map((item) => ({
            id: String(item?.id || "").trim(),
            name: String(item?.name || "").trim(),
          }))
          .filter((item) => item.id && item.name)
      : [];

    let planningRows = dedupedUserIds.map((userId, index) => {
      const member = usersById.get(userId);
      const budgetRow = budgetByUserId.get(userId);
      const managerAssignment = managerAssignmentByUser.get(userId);
      const memberAssignment = memberAssignmentByUser.get(userId);
      const baseRate = toNullableNumber(member?.baseRate ?? member?.base_rate);
      const costRate = toNullableNumber(member?.costRate ?? member?.cost_rate);
      const managerChargeOverride = toNullableNumber(
        managerAssignment?.chargeRateOverride ?? managerAssignment?.charge_rate_override
      );
      const memberChargeOverride = toNullableNumber(
        memberAssignment?.chargeRateOverride ?? memberAssignment?.charge_rate_override
      );
      const chargeRateOverride = managerChargeOverride ?? memberChargeOverride;
      const budgetRateOverride = toNullableNumber(budgetRow?.rateOverride);
      const memberLevel = Number.isFinite(Number(member?.level)) ? Number(member.level) : null;
      const levelDef = memberLevel !== null ? levelLabelMap[String(memberLevel)] : null;
      const titleFromLevel =
        typeof levelDef?.label === "string" && levelDef.label.trim()
          ? levelDef.label.trim()
          : "";
      const roleLabel = titleFromLevel || String(member?.role || member?.permissionGroup || member?.permission_group || "—");
      return {
        id: userId || `row-${index}`,
        userId: userId || null,
        memberName: member?.displayName || "Unassigned",
        role: roleLabel,
        removeAction: managerAssignment ? "manager" : memberAssignment ? "member" : null,
        canDelete:
          Boolean(userId) &&
          String(userId || "").trim() !== String(leadUserId || "").trim() &&
          Boolean(managerAssignment || memberAssignment),
        baseRate,
        costRate: costRate ?? baseRate ?? 0,
        chargeRate: budgetRateOverride ?? chargeRateOverride ?? baseRate ?? 0,
        hours: toNullableNumber(budgetRow?.budgetHours) ?? 0,
      };
    });
    planningRows = computeRows(planningRows);
    const plannedExpensesSource = Array.isArray(state?.projectPlannedExpenses)
      ? state.projectPlannedExpenses
      : [];
    planningExpenseRows = plannedExpensesSource
      .filter((row) => String(row?.projectId || "").trim() === projectIdKey)
      .map((row) => ({
        id: String(row?.id || "").trim(),
        categoryId: String(row?.categoryId || "").trim(),
        description: String(row?.description || ""),
        units: toNumberOrZero(row?.units),
        unitCost: toNumberOrZero(row?.unitCost),
        markupPct: toNumberOrZero(row?.markupPct),
        billable: row?.billable === true,
      }))
      .filter((row) => row.id);
    const initialTotals = computeTotals(planningRows, contractAmountValue, overheadValue);
    const initialExpenseTotals = computeExpenseTotals(planningExpenseRows);
    const initialIsTmContract = contractType === "tm";
    const initialBaseRevenue = initialIsTmContract
      ? initialTotals.plannedRevenueTotal
      : (Number.isFinite(contractAmountValue) ? contractAmountValue : 0);
    const initialTotalRevenue = initialBaseRevenue + initialExpenseTotals.expenseRevenue;
    const initialTotalCost = initialTotals.directCost + initialExpenseTotals.expenseCost + initialTotals.overheadCost;
    const initialGrossMarginValue = initialTotalRevenue - initialTotalCost;
    const initialGrossMarginPct = initialTotalRevenue > 0
      ? (initialGrossMarginValue / initialTotalRevenue) * 100
      : null;
    const initialRealizationNumerator = initialIsTmContract
      ? initialTotals.plannedRevenueTotal
      : contractAmountValue;
    const initialDiscountPremiumValue = Number.isFinite(initialRealizationNumerator)
      ? initialRealizationNumerator - initialTotals.standardRevenueTotal
      : null;

    container.innerHTML = `
      <section class="page-view project-planning-page" aria-label="Project Planning">
        <header class="project-planning-head">
          <div class="project-planning-head-main">
            <p class="project-planning-subtitle">${escapeHtml(subtitle)}</p>
            <div class="project-planning-contract-type-toggle" role="tablist" aria-label="Contract type">
              <button
                type="button"
                class="project-planning-contract-type-option is-active"
                data-contract-type-value="fixed"
                role="tab"
                aria-selected="true"
              >
                Fixed Fee
              </button>
              <button
                type="button"
                class="project-planning-contract-type-option"
                data-contract-type-value="tm"
                role="tab"
                aria-selected="false"
              >
                Time &amp; Materials
              </button>
            </div>
          </div>
          <div class="project-planning-actions">
            <button type="button" class="button button-ghost" data-project-planning-back>Back</button>
            <button type="button" class="button" data-project-planning-save>Submit</button>
          </div>
        </header>
        <section class="project-planning-kpi-row">
            <section class="project-planning-kpis">
              <article class="project-planning-kpi" data-kpi-card="contract">
                <div class="project-planning-kpi-label" data-kpi-label="contractPrimary">Planned Revenue</div>
                <div class="project-planning-kpi-value" data-kpi="contract">${escapeHtml(fmtMoneyZero(initialTotalRevenue))}</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Planned Cost</div>
                <div class="project-planning-kpi-value" data-kpi="plannedCost">${escapeHtml(fmtMoneyZero(initialTotalCost))}</div>
                <div class="project-planning-kpi-sub">
                  <div class="project-planning-kpi-subline">
                    <span>Direct</span>
                    <strong data-kpi="plannedDirect">${escapeHtml(fmtMoneyZero(initialTotals.directCost))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline">
                    <span>Overhead</span>
                    <strong data-kpi="plannedOverhead">${escapeHtml(fmtMoneyZero(initialTotals.overheadCost + initialExpenseTotals.expenseCost))}</strong>
                  </div>
                </div>
              </article>
              <article class="project-planning-kpi is-emphasis">
                <div class="project-planning-kpi-label">Gross Margin</div>
                <div class="project-planning-kpi-value" data-kpi="grossMargin">${escapeHtml(Number.isFinite(initialGrossMarginValue) ? fmtMoneyZero(initialGrossMarginValue) : "—")}</div>
                <div class="project-planning-kpi-sub">
                  <div class="project-planning-kpi-subline">
                    <span data-kpi-label="grossTopLine">Revenue</span>
                    <strong data-kpi="grossContract">${escapeHtml(fmtMoneyZero(initialTotalRevenue))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline">
                    <span>Cost</span>
                    <strong data-kpi="grossCost">${escapeHtml(fmtMoneyZero(initialTotalCost))}</strong>
                  </div>
                </div>
              </article>
              <article class="project-planning-kpi is-emphasis">
                <div class="project-planning-kpi-label" data-kpi-label="realizationPrimary">Realization</div>
                <div class="project-planning-kpi-value" data-kpi="realizationPct">${escapeHtml(initialTotals.standardRevenueTotal > 0 && Number.isFinite(initialRealizationNumerator) ? fmtPercent((initialRealizationNumerator / initialTotals.standardRevenueTotal) * 100) : "—")}</div>
                <div class="project-planning-kpi-sub" data-kpi="realizationSub">
                  <div class="project-planning-kpi-subline">
                    <span>Std Rev</span>
                    <strong data-kpi="standardRevenue">${escapeHtml(fmtMoneyZero(initialTotals.standardRevenueTotal))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline ${Number.isFinite(initialDiscountPremiumValue) && initialDiscountPremiumValue < 0 ? "is-negative" : "is-positive"}">
                    <span data-kpi-label="premiumDiscount">${initialIsTmContract ? "Variance to Standard" : Number.isFinite(initialDiscountPremiumValue) && initialDiscountPremiumValue < 0 ? "Discount" : "Premium"}</span>
                    <strong data-kpi="premiumDiscount">${escapeHtml(Number.isFinite(initialDiscountPremiumValue) ? fmtMoney(initialDiscountPremiumValue) : "—")}</strong>
                  </div>
                </div>
              </article>
            </section>
        </section>
        <div class="project-planning-layout project-planning-body">
          <main>
            <section class="project-planning-block project-planning-table-card">
              <div class="project-planning-table-head">
                <div class="project-planning-table-head-main">
                  <h3>Team Budgeting</h3>
                  <div class="project-planning-contract-type-toggle" role="tablist" aria-label="Planning table">
                    <button
                      type="button"
                      class="project-planning-contract-type-option is-active"
                      data-planning-tab-value="time"
                      role="tab"
                      aria-selected="true"
                    >
                      Time
                    </button>
                    <button
                      type="button"
                      class="project-planning-contract-type-option"
                      data-planning-tab-value="expenses"
                      role="tab"
                      aria-selected="false"
                    >
                      Expenses
                    </button>
                  </div>
                </div>
                <div class="project-planning-actions">
                  <button type="button" class="button button-ghost" data-project-planning-add-member>Add Member</button>
                  <button type="button" class="button button-ghost" data-project-planning-add-expense hidden>Add Expense</button>
                </div>
              </div>
              <div class="project-planning-table-panels">
                <div class="project-planning-table-wrap" data-planning-tab-panel="time">
                  <table class="project-planning-table">
                    <colgroup>
                      <col class="time-col-member" />
                      <col class="time-col-role" />
                      <col class="time-col-cost-rate" />
                      <col class="time-col-charge-rate" />
                      <col class="time-col-hours" />
                      <col class="time-col-cost" />
                      <col class="time-col-revenue" />
                      <col class="time-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Cost Rate</th>
                        <th>Charge Rate</th>
                        <th>Hours</th>
                        <th>Cost</th>
                        <th>Revenue</th>
                        <th class="table-actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        planningRows.length
                          ? planningRows
                              .map((row) => {
                                return `
                                  <tr class="table-row-surface" data-row-id="${escapeHtml(row.id)}">
                                    <td>${escapeHtml(row.memberName)}</td>
                                    <td>${escapeHtml(String(row.role).replace(/_/g, " "))}</td>
                                    <td class="table-numeric table-output" data-row-output="costRate" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtMoneyZero(row.costRate))}</td>
                                    <td class="table-numeric table-input-cell"><input class="project-planning-input table-input" type="number" min="0" step="0.01" data-row-input="chargeRate" data-row-id="${escapeHtml(row.id)}" value="${escapeHtml(row.chargeRate)}" /></td>
                                    <td class="table-numeric table-input-cell"><input class="project-planning-input table-input" type="number" min="0" step="0.25" data-row-input="hours" data-row-id="${escapeHtml(row.id)}" value="${escapeHtml(row.hours)}" /></td>
                                    <td class="table-numeric table-output" data-row-output="cost" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtMoneyZero(row.plannedCost))}</td>
                                    <td class="table-numeric table-output" data-row-output="revenue" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtMoneyZero(row.plannedRevenue))}</td>
                                    <td class="table-actions">
                                      ${
                                        row.canDelete
                                          ? `<button type="button" class="project-planning-row-delete" data-row-delete="${escapeHtml(row.id)}" aria-label="Delete member">${PROJECT_PLANNING_DELETE_ICON}</button>`
                                          : `<button type="button" class="project-planning-row-delete" aria-hidden="true" disabled>${PROJECT_PLANNING_DELETE_ICON}</button>`
                                      }
                                    </td>
                                  </tr>
                                `;
                              })
                              .join("")
                          : `
                            <tr>
                              <td colspan="8" class="project-planning-placeholder">No team budgeting rows yet.</td>
                            </tr>
                          `
                      }
                    </tbody>
                  </table>
                </div>
                <div class="project-planning-expenses-panel" data-planning-tab-panel="expenses" hidden>
                  <div class="project-planning-table-wrap">
                    <table class="project-planning-table">
                      <colgroup>
                        <col class="exp-col-category" />
                        <col class="exp-col-description" />
                        <col class="exp-col-units" />
                        <col class="exp-col-unit-cost" />
                        <col class="exp-col-markup" />
                        <col class="exp-col-total" />
                        <col class="exp-col-billable" />
                        <col class="exp-col-actions" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Description</th>
                          <th>Units</th>
                          <th>Unit Cost</th>
                          <th>Markup %</th>
                          <th>Total</th>
                          <th>Billable</th>
                          <th class="table-actions"></th>
                        </tr>
                      </thead>
                      <tbody data-expense-rows-body>
                        <tr>
                          <td colspan="8" class="project-planning-placeholder">No expense rows yet.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </main>
          <aside class="project-planning-right">
            <section class="project-planning-block project-planning-economics">
              <h4>Project Economics</h4>
              <section class="project-planning-econ-section">
                <div class="project-planning-econ-title">Revenue</div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label" data-econ-label="revenuePrimary">${initialIsTmContract ? "Time Revenue" : "Contract Amount"}</span>
                  <span class="project-planning-econ-value" data-econ="revenuePrimary">${escapeHtml(initialIsTmContract ? fmtMoneyZero(initialTotals.plannedRevenueTotal) : fmtMoneyZero(contractAmountValue))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label" data-econ-label="revenueSecondary">Expense Revenue</span>
                  <span class="project-planning-econ-value" data-econ="revenueSecondary">${escapeHtml(fmtMoneyZero(initialExpenseTotals.expenseRevenue))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label" data-econ-label="revenueTertiary">Total Revenue</span>
                  <span class="project-planning-econ-value" data-econ="revenueTertiary">
                    ${escapeHtml(fmtMoneyZero(initialTotalRevenue))}
                  </span>
                </div>
              </section>
              <section class="project-planning-econ-section">
                <div class="project-planning-econ-title">Costs</div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Direct Labor Cost</span>
                  <span class="project-planning-econ-value" data-econ="directCost">${escapeHtml(fmtMoneyZero(initialTotals.directCost))}</span>
                </div>
                <div class="project-planning-econ-row" data-econ-row="expenseCost">
                  <span class="project-planning-econ-label">Expense Cost</span>
                  <span class="project-planning-econ-value" data-econ="expenseCost">${escapeHtml(fmtMoneyZero(initialExpenseTotals.expenseCost))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Overhead</span>
                  <span class="project-planning-econ-value" data-econ="overheadCost">${escapeHtml(fmtMoneyZero(initialTotals.overheadCost))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Total Cost</span>
                  <span class="project-planning-econ-value" data-econ="totalCost">${escapeHtml(fmtMoneyZero(initialTotalCost))}</span>
                </div>
              </section>
              <section class="project-planning-econ-section">
                <div class="project-planning-econ-title">Profitability</div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Gross Margin</span>
                  <span class="project-planning-econ-value" data-econ="grossMargin">${escapeHtml(Number.isFinite(initialGrossMarginValue) ? fmtMoney(initialGrossMarginValue) : "—")}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Gross Margin %</span>
                  <span class="project-planning-econ-value" data-econ="grossMarginPct">${escapeHtml(Number.isFinite(initialGrossMarginPct) ? fmtPercent(initialGrossMarginPct) : "—")}</span>
                </div>
              </section>
            </section>
          </aside>
        </div>
      </section>
    `;

    container.querySelector("[data-project-planning-back]")?.addEventListener("click", () => {
      if (typeof onBack === "function") onBack();
    });
    const saveButton = container.querySelector("[data-project-planning-save]");
    saveButton?.addEventListener("click", async () => {
      if (typeof onSave !== "function") return;
      planningRows = computeRows(planningRows);
      const members = planningRows.map((row) => {
        const rawHours = row.hours;
        const normalizedHours =
          rawHours === null || rawHours === undefined || rawHours === "" ? null : toNumberOrZero(rawHours);
        const rateOverride =
          row.chargeRate === null || row.chargeRate === undefined || row.chargeRate === ""
            ? null
            : toNumberOrZero(row.chargeRate);
        const budgetAmount = normalizedHours === null || rateOverride === null
          ? null
          : Number((rateOverride * normalizedHours).toFixed(2));
        return {
          userId: String(row.userId || row.id || "").trim(),
          budgetHours: normalizedHours,
          budgetAmount,
          rateOverride,
        };
      }).filter((row) => row.userId);
      saveButton.disabled = true;
      try {
        await onSave({
          projectId: String(project?.id || "").trim(),
          members,
        });
      } finally {
        saveButton.disabled = false;
      }
    });

    const persistedRowFields = new Map(
      planningRows.map((row) => [
        String(row.id),
        {
          chargeRate: row.chargeRate,
          hours: row.hours,
        },
      ])
    );
    const kpiContractNode = container.querySelector('[data-kpi="contract"]');
    const kpiPlannedCostNode = container.querySelector('[data-kpi="plannedCost"]');
    const kpiPlannedDirectNode = container.querySelector('[data-kpi="plannedDirect"]');
    const kpiPlannedOverheadNode = container.querySelector('[data-kpi="plannedOverhead"]');
    const kpiGrossMarginNode = container.querySelector('[data-kpi="grossMargin"]');
    const kpiGrossContractNode = container.querySelector('[data-kpi="grossContract"]');
    const kpiGrossCostNode = container.querySelector('[data-kpi="grossCost"]');
    const kpiRealizationPctNode = container.querySelector('[data-kpi="realizationPct"]');
    const kpiRealizationSubNode = container.querySelector('[data-kpi="realizationSub"]');
    const kpiContractLabelNode = container.querySelector('[data-kpi-label="contractPrimary"]');
    const kpiRealizationLabelNode = container.querySelector('[data-kpi-label="realizationPrimary"]');
    const kpiGrossTopLineLabelNode = container.querySelector('[data-kpi-label="grossTopLine"]');
    const kpiStandardRevenueNode = container.querySelector('[data-kpi="standardRevenue"]');
    const kpiPremiumDiscountNode = container.querySelector('[data-kpi="premiumDiscount"]');
    const kpiPremiumDiscountLabelNode = container.querySelector('[data-kpi-label="premiumDiscount"]');
    const econRevenuePrimaryNode = container.querySelector('[data-econ="revenuePrimary"]');
    const econRevenueSecondaryNode = container.querySelector('[data-econ="revenueSecondary"]');
    const econRevenueTertiaryNode = container.querySelector('[data-econ="revenueTertiary"]');
    const econRevenuePrimaryLabelNode = container.querySelector('[data-econ-label="revenuePrimary"]');
    const econRevenueSecondaryLabelNode = container.querySelector('[data-econ-label="revenueSecondary"]');
    const econRevenueTertiaryLabelNode = container.querySelector('[data-econ-label="revenueTertiary"]');
    const econDirectCostNode = container.querySelector('[data-econ="directCost"]');
    const econExpenseCostNode = container.querySelector('[data-econ="expenseCost"]');
    const econExpenseCostRowNode = container.querySelector('[data-econ-row="expenseCost"]');
    const econOverheadCostNode = container.querySelector('[data-econ="overheadCost"]');
    const econTotalCostNode = container.querySelector('[data-econ="totalCost"]');
    const econGrossMarginNode = container.querySelector('[data-econ="grossMargin"]');
    const econGrossMarginPctNode = container.querySelector('[data-econ="grossMarginPct"]');
    let isEditingContractAmount = false;

    async function commitContractAmount(rawValue) {
      const previousValue = contractAmountValue;
      const trimmed = String(rawValue ?? "").trim();
      let nextValue = previousValue;
      if (!trimmed) {
        nextValue = null;
      } else {
        const numeric = Number(trimmed.replace(/,/g, "").replace(/[^\d.-]/g, ""));
        if (Number.isFinite(numeric)) {
          nextValue = numeric;
        }
      }
      const unchanged =
        (previousValue === null && nextValue === null) ||
        (previousValue !== null && nextValue !== null && Number(previousValue) === Number(nextValue));
      contractAmountValue = nextValue;
      isEditingContractAmount = false;
      renderComputed();
      if (unchanged) return;
      try {
        if (typeof onPersistContractAmount === "function") {
          await onPersistContractAmount({
            projectId: String(project?.id || "").trim(),
            contractAmount: nextValue,
          });
        }
      } catch (error) {
        contractAmountValue = previousValue;
        renderComputed();
      }
    }

    function enterContractAmountEditMode() {
      if (!econRevenuePrimaryNode || contractType === "tm" || isEditingContractAmount) return;
      isEditingContractAmount = true;
      const currentRaw = contractAmountValue === null || contractAmountValue === undefined
        ? ""
        : String(Number(contractAmountValue));
      econRevenuePrimaryNode.innerHTML = `<input class="project-planning-input project-planning-econ-edit-input" type="text" inputmode="decimal" value="${escapeHtml(currentRaw)}" data-contract-edit-input />`;
      const editInput = econRevenuePrimaryNode.querySelector("[data-contract-edit-input]");
      bindContractAmountInput(editInput);
      editInput?.focus();
      editInput?.select();
    }

    function bindContractAmountInput(editInput) {
      if (!editInput) return;
      editInput.addEventListener("focus", () => {
        isEditingContractAmount = true;
      });
      editInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          editInput.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          editInput.value = contractAmountValue === null || contractAmountValue === undefined
            ? ""
            : String(Number(contractAmountValue));
          editInput.blur();
        }
      });
      editInput.addEventListener("blur", () => {
        commitContractAmount(editInput.value);
      });
    }
    function setEconomicSignal(node, value, options = {}) {
      if (!node) return;
      node.classList.remove("is-negative", "is-positive");
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      if (options.negativeIsDanger && value < 0) node.classList.add("is-negative");
      if (options.positiveIsSuccess && value > 0) node.classList.add("is-positive");
    }

    function renderComputed() {
      planningRows = computeRows(planningRows);
      const totals = computeTotals(planningRows, contractAmountValue, overheadValue);
      const expenseTotals = computeExpenseTotals(planningExpenseRows);
      const isTmContract = contractType === "tm";
      const baseRevenueValue = isTmContract
        ? totals.plannedRevenueTotal
        : (Number.isFinite(contractAmountValue) ? contractAmountValue : 0);
      const expenseRevenueTotal = expenseTotals.expenseRevenue;
      const expenseCostTotal = expenseTotals.expenseCost;
      const totalRevenueValue = baseRevenueValue + expenseRevenueTotal;
      const totalCostValue = totals.directCost + expenseCostTotal + totals.overheadCost;
      const grossMarginValue = totalRevenueValue - totalCostValue;
      const grossMarginPct = totalRevenueValue > 0
        ? (grossMarginValue / totalRevenueValue) * 100
        : null;
      const realizationNumerator = isTmContract ? totals.plannedRevenueTotal : contractAmountValue;
      const realizationPct =
        totals.standardRevenueTotal > 0 && Number.isFinite(realizationNumerator)
          ? (realizationNumerator / totals.standardRevenueTotal) * 100
          : null;

      planningRows.forEach((row) => {
        const rowId = String(row.id);
        const costNode = container.querySelector(`[data-row-output="cost"][data-row-id="${rowId}"]`);
        const revenueNode = container.querySelector(`[data-row-output="revenue"][data-row-id="${rowId}"]`);
        if (costNode) costNode.textContent = fmtMoneyZero(row.plannedCost);
        if (revenueNode) revenueNode.textContent = fmtMoneyZero(row.plannedRevenue);
      });

      if (kpiContractLabelNode) {
        kpiContractLabelNode.textContent = "Planned Revenue";
      }
      if (kpiContractNode) {
        kpiContractNode.textContent = fmtMoneyZero(totalRevenueValue);
      }
      if (kpiPlannedCostNode) kpiPlannedCostNode.textContent = fmtMoneyZero(totalCostValue);
      if (kpiPlannedDirectNode) kpiPlannedDirectNode.textContent = fmtMoneyZero(totals.directCost);
      if (kpiPlannedOverheadNode) kpiPlannedOverheadNode.textContent = fmtMoneyZero(totals.overheadCost + expenseCostTotal);
      if (kpiGrossMarginNode) kpiGrossMarginNode.textContent = Number.isFinite(grossMarginValue) ? fmtMoneyZero(grossMarginValue) : "—";
      if (kpiGrossTopLineLabelNode) {
        kpiGrossTopLineLabelNode.textContent = "Revenue";
      }
      if (kpiGrossContractNode) {
        kpiGrossContractNode.textContent = fmtMoneyZero(totalRevenueValue);
      }
      if (kpiGrossCostNode) kpiGrossCostNode.textContent = fmtMoneyZero(totalCostValue);
      if (kpiRealizationLabelNode) {
        kpiRealizationLabelNode.textContent = "Realization";
      }
      if (kpiRealizationSubNode) {
        kpiRealizationSubNode.hidden = false;
      }
      if (kpiRealizationPctNode) {
        kpiRealizationPctNode.textContent = realizationPct === null ? "—" : fmtPercent(realizationPct);
      }
      if (kpiStandardRevenueNode) kpiStandardRevenueNode.textContent = fmtMoneyZero(totals.standardRevenueTotal);
      const discountPremiumValue = Number.isFinite(realizationNumerator)
        ? realizationNumerator - totals.standardRevenueTotal
        : null;
      if (kpiPremiumDiscountLabelNode) {
        kpiPremiumDiscountLabelNode.textContent = isTmContract
          ? "Variance to Standard"
          : Number.isFinite(discountPremiumValue) && discountPremiumValue < 0
            ? "Discount"
            : "Premium";
      }
      if (kpiPremiumDiscountNode) {
        kpiPremiumDiscountNode.textContent = Number.isFinite(discountPremiumValue) ? fmtMoney(discountPremiumValue) : "—";
        kpiPremiumDiscountNode.parentElement?.classList.remove("is-positive", "is-negative");
        if (Number.isFinite(discountPremiumValue)) {
          if (discountPremiumValue < 0) kpiPremiumDiscountNode.parentElement?.classList.add("is-negative");
          if (discountPremiumValue > 0) kpiPremiumDiscountNode.parentElement?.classList.add("is-positive");
        }
      }
      if (econRevenuePrimaryLabelNode) econRevenuePrimaryLabelNode.textContent = isTmContract ? "Time Revenue" : "Contract Amount";
      if (econRevenueSecondaryLabelNode) econRevenueSecondaryLabelNode.textContent = "Expense Revenue";
      if (econRevenueTertiaryLabelNode) econRevenueTertiaryLabelNode.textContent = "Total Revenue";
      if (econRevenuePrimaryNode) {
        if (isTmContract) {
          isEditingContractAmount = false;
          econRevenuePrimaryNode.classList.remove("is-editable");
          econRevenuePrimaryNode.textContent = fmtMoneyZero(totals.plannedRevenueTotal);
        } else {
          econRevenuePrimaryNode.classList.add("is-editable");
          if (!isEditingContractAmount) {
            const currentDisplay = contractAmountValue === null || contractAmountValue === undefined
              ? ""
              : fmtMoneyZero(contractAmountValue);
            econRevenuePrimaryNode.innerHTML = `
              <span class="project-planning-econ-edit-display">
                <span class="project-planning-econ-edit-trigger" data-contract-edit-trigger aria-hidden="true">✎</span>
                <span class="project-planning-econ-edit-value">${escapeHtml(currentDisplay)}</span>
              </span>
            `;
          }
        }
      }
      if (econRevenueSecondaryNode) {
        econRevenueSecondaryNode.textContent = fmtMoneyZero(expenseRevenueTotal);
      }
      if (econRevenueTertiaryNode) {
        econRevenueTertiaryNode.textContent = fmtMoneyZero(totalRevenueValue);
        econRevenueTertiaryNode.classList.remove("is-negative", "is-positive");
      }
      if (econDirectCostNode) econDirectCostNode.textContent = fmtMoneyZero(totals.directCost);
      if (econExpenseCostRowNode) econExpenseCostRowNode.hidden = false;
      if (econExpenseCostNode) econExpenseCostNode.textContent = fmtMoneyZero(expenseCostTotal);
      if (econOverheadCostNode) econOverheadCostNode.textContent = fmtMoneyZero(totals.overheadCost);
      if (econTotalCostNode) econTotalCostNode.textContent = fmtMoneyZero(totalCostValue);
      if (econGrossMarginNode) {
        econGrossMarginNode.textContent = Number.isFinite(grossMarginValue) ? fmtMoney(grossMarginValue) : "—";
        setEconomicSignal(econGrossMarginNode, grossMarginValue, {
          negativeIsDanger: true,
          positiveIsSuccess: true,
        });
      }
      if (econGrossMarginPctNode) {
        econGrossMarginPctNode.textContent = Number.isFinite(grossMarginPct) ? fmtPercent(grossMarginPct) : "—";
        setEconomicSignal(econGrossMarginPctNode, grossMarginPct, {
          negativeIsDanger: true,
          positiveIsSuccess: true,
        });
      }
    }

    econRevenuePrimaryNode?.addEventListener("click", (event) => {
      if (contractType === "tm") return;
      if (event.target && event.target.closest("[data-contract-edit-input]")) return;
      enterContractAmountEditMode();
    });

    function normalizeBudgetFieldValue(value) {
      if (value === null || value === undefined || value === "") return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }
    function fieldValuesEqual(left, right) {
      if (left === right) return true;
      if (left === null || left === undefined || left === "") {
        return right === null || right === undefined || right === "";
      }
      if (right === null || right === undefined || right === "") {
        return false;
      }
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
      return leftNumber === rightNumber;
    }
    container.querySelectorAll("[data-row-input]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const target = event.target;
        const rowId = String(target?.dataset?.rowId || "");
        const field = String(target?.dataset?.rowInput || "");
        if (!rowId || !field) return;
        const row = planningRows.find((item) => String(item.id) === rowId);
        if (!row) return;
        const nextValue = normalizeBudgetFieldValue(String(target.value || "").trim());
        row[field] = nextValue;
        renderComputed();
      });
      input.addEventListener("blur", async (event) => {
        const target = event.target;
        const rowId = String(target?.dataset?.rowId || "");
        const field = String(target?.dataset?.rowInput || "");
        if (!rowId || !field) return;
        if (field !== "chargeRate" && field !== "hours") return;
        const row = planningRows.find((item) => String(item.id) === rowId);
        if (!row) return;
        const persisted = persistedRowFields.get(rowId) || {};
        const previousValue = persisted[field];
        const nextValue = row[field];
        if (fieldValuesEqual(previousValue, nextValue)) return;
        if (typeof onPersistField !== "function") {
          persistedRowFields.set(rowId, { ...persisted, [field]: nextValue });
          return;
        }
        target.disabled = true;
        try {
          await onPersistField({
            projectId: String(project?.id || "").trim(),
            userId: String(row.userId || "").trim(),
            rowId,
            field,
            value: nextValue,
          });
          persistedRowFields.set(rowId, { ...persisted, [field]: nextValue });
        } catch (error) {
          row[field] = previousValue ?? null;
          target.value = previousValue === null || previousValue === undefined ? "" : String(previousValue);
          renderComputed();
        } finally {
          target.disabled = false;
        }
      });
    });

    const addMemberButton = container.querySelector("[data-project-planning-add-member]");
    const addExpenseButton = container.querySelector("[data-project-planning-add-expense]");
    const planningTabButtons = Array.from(container.querySelectorAll("[data-planning-tab-value]"));
    const planningTabPanels = {
      time: container.querySelector('[data-planning-tab-panel="time"]'),
      expenses: container.querySelector('[data-planning-tab-panel="expenses"]'),
    };
    const expenseRowsBody = container.querySelector("[data-expense-rows-body]");

    function makeExpenseRow(defaultBillable = false) {
      return {
        id: `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        categoryId: "",
        description: "",
        units: 0,
        unitCost: 0,
        markupPct: 0,
        billable: defaultBillable === true,
      };
    }

    function normalizeExpenseFieldValue(field, value) {
      if (field === "categoryId" || field === "description") {
        return String(value || "").trim();
      }
      if (field === "billable") {
        return value === true;
      }
      if (field === "units") {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
      }
      if (field === "unitCost" || field === "markupPct") {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      }
      return value;
    }

    function expenseFieldValuesEqual(field, left, right) {
      const a = normalizeExpenseFieldValue(field, left);
      const b = normalizeExpenseFieldValue(field, right);
      if (typeof a === "number" && typeof b === "number") return a === b;
      return a === b;
    }

    const persistedExpenseFields = new Map(
      planningExpenseRows.map((row) => [
        String(row.id),
        {
          categoryId: String(row.categoryId || "").trim(),
          description: String(row.description || "").trim(),
          units: normalizeExpenseFieldValue("units", row.units),
          unitCost: normalizeExpenseFieldValue("unitCost", row.unitCost),
          markupPct: normalizeExpenseFieldValue("markupPct", row.markupPct),
          billable: row.billable === true,
        },
      ])
    );
    const expenseDraftMeta = new Map(
      planningExpenseRows.map((row) => [
        String(row.id),
        {
          isNew: false,
          customizedMarkupPct: false,
          customizedBillable: false,
        },
      ])
    );
    const expenseFieldRequestSeq = new Map();

    function computeExpenseRowTotal(row) {
      const units = toNumberOrZero(row?.units);
      const unitCost = toNumberOrZero(row?.unitCost);
      return units * unitCost;
    }

    function renderExpensesTable() {
      if (!expenseRowsBody) return;
      if (!planningExpenseRows.length) {
        expenseRowsBody.innerHTML = `<tr><td colspan="8" class="project-planning-placeholder">No expense rows yet.</td></tr>`;
        return;
      }
      expenseRowsBody.innerHTML = planningExpenseRows
        .map((row) => {
          const rowId = escapeHtml(row.id);
          const selectedCategory = String(row.categoryId || "");
          const categorySelect = [
            `<option value="" ${selectedCategory ? "" : "selected"}>Select</option>`,
            ...projectExpenseCategories.map(
              (item) =>
                `<option value="${escapeHtml(item.id)}" ${item.id === selectedCategory ? "selected" : ""}>${escapeHtml(item.name)}</option>`
            ),
          ].join("");
          return `
            <tr class="table-row-surface" data-expense-row-id="${rowId}">
              <td>
                <select class="project-planning-input table-input" data-expense-input="categoryId" data-expense-row-id="${rowId}">
                  ${categorySelect}
                </select>
              </td>
              <td>
                <input class="project-planning-input table-input" type="text" data-expense-input="description" data-expense-row-id="${rowId}" value="${escapeHtml(row.description || "")}" />
              </td>
              <td class="table-numeric">
                <input class="project-planning-input table-input" type="number" min="0" step="1" data-expense-input="units" data-expense-row-id="${rowId}" value="${escapeHtml(toNumberOrZero(row.units))}" />
              </td>
              <td class="table-numeric">
                <input class="project-planning-input table-input" type="number" min="0" step="0.01" data-expense-input="unitCost" data-expense-row-id="${rowId}" value="${escapeHtml(toNumberOrZero(row.unitCost))}" />
              </td>
              <td class="table-numeric">
                <input class="project-planning-input table-input" type="number" min="0" step="0.01" data-expense-input="markupPct" data-expense-row-id="${rowId}" value="${escapeHtml(toNumberOrZero(row.markupPct))}" />
              </td>
              <td class="table-numeric table-output">${escapeHtml(fmtMoneyZero(computeExpenseRowTotal(row)))}</td>
              <td>
                <label class="perm-switch" aria-label="Billable">
                  <input type="checkbox" data-expense-input="billable" data-expense-row-id="${rowId}" ${row.billable ? "checked" : ""} />
                  <span class="perm-switch-track" aria-hidden="true"></span>
                </label>
              </td>
              <td class="table-actions">
                <button type="button" class="project-planning-row-delete" data-expense-delete="${rowId}" aria-label="Delete expense">${PROJECT_PLANNING_DELETE_ICON}</button>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    function syncPlanningTab() {
      planningTabButtons.forEach((button) => {
        const value = String(button.dataset.planningTabValue || "").trim();
        const isActive = value === activePlanningTab;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      if (planningTabPanels.time) {
        planningTabPanels.time.hidden = activePlanningTab !== "time";
      }
      if (planningTabPanels.expenses) {
        planningTabPanels.expenses.hidden = activePlanningTab !== "expenses";
      }
      if (addMemberButton) {
        addMemberButton.hidden = activePlanningTab !== "time";
      }
      if (addExpenseButton) {
        addExpenseButton.hidden = activePlanningTab !== "expenses";
      }
    }

    planningTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextTab = String(button.dataset.planningTabValue || "").trim();
        if (nextTab !== "time" && nextTab !== "expenses") return;
        if (nextTab === activePlanningTab) return;
        activePlanningTab = nextTab;
        syncPlanningTab();
      });
    });

    addExpenseButton?.addEventListener("click", async () => {
      const projectIdValue = String(project?.id || "").trim();
      if (!projectIdValue) return;
      const defaultBillable = contractType === "tm";
      const optimisticRow = makeExpenseRow(defaultBillable);
      const optimisticId = String(optimisticRow.id);
      planningExpenseRows = [...planningExpenseRows, optimisticRow];
      persistedExpenseFields.set(optimisticId, {
        categoryId: "",
        description: "",
        units: 0,
        unitCost: 0,
        markupPct: 0,
        billable: defaultBillable,
      });
      expenseDraftMeta.set(optimisticId, {
        isNew: true,
        customizedMarkupPct: false,
        customizedBillable: false,
      });
      renderExpensesTable();
      renderComputed();
      addExpenseButton.disabled = true;
      try {
        if (typeof onCreateExpenseRow === "function") {
          const created = await onCreateExpenseRow({
            projectId: projectIdValue,
            categoryId: "",
            description: "",
            units: 0,
            unitCost: 0,
            markupPct: 0,
            billable: defaultBillable,
          });
          const createdId = String(created?.id || "").trim();
          if (!createdId) {
            throw new Error("Unable to create expense row.");
          }
          const nextRow = {
            id: createdId,
            categoryId: String(created?.categoryId || "").trim(),
            description: String(created?.description || ""),
            units: normalizeExpenseFieldValue("units", created?.units),
            unitCost: normalizeExpenseFieldValue("unitCost", created?.unitCost),
            markupPct: normalizeExpenseFieldValue("markupPct", created?.markupPct),
            billable: created?.billable === true,
          };
          planningExpenseRows = planningExpenseRows.map((item) =>
            String(item.id) === optimisticId ? nextRow : item
          );
          persistedExpenseFields.delete(optimisticId);
          expenseDraftMeta.delete(optimisticId);
          persistedExpenseFields.set(createdId, {
            categoryId: nextRow.categoryId,
            description: String(nextRow.description || "").trim(),
            units: nextRow.units,
            unitCost: nextRow.unitCost,
            markupPct: nextRow.markupPct,
            billable: nextRow.billable,
          });
          expenseDraftMeta.set(createdId, {
            isNew: true,
            customizedMarkupPct: false,
            customizedBillable: false,
          });
        }
        renderExpensesTable();
        renderComputed();
      } catch (error) {
        planningExpenseRows = planningExpenseRows.filter((item) => String(item.id) !== optimisticId);
        persistedExpenseFields.delete(optimisticId);
        expenseDraftMeta.delete(optimisticId);
        renderExpensesTable();
        renderComputed();
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert(error?.message || "Unable to create expense row.");
        }
        return;
      } finally {
        addExpenseButton.disabled = false;
      }
    });

    expenseRowsBody?.addEventListener("input", (event) => {
      const target = event.target;
      const inputKey = String(target?.dataset?.expenseInput || "").trim();
      const rowId = String(target?.dataset?.expenseRowId || "").trim();
      if (!inputKey || !rowId) return;
      const row = planningExpenseRows.find((item) => String(item.id) === rowId);
      if (!row) return;
      if (inputKey === "description" || inputKey === "categoryId") {
        row[inputKey] = String(target.value || "");
      } else if (inputKey === "units" || inputKey === "unitCost" || inputKey === "markupPct") {
        const next = String(target.value || "").trim();
        if (inputKey === "units") {
          const parsed = next === "" ? 0 : Math.max(0, Math.trunc(toNumberOrZero(next)));
          row.units = parsed;
          target.value = String(parsed);
        } else if (inputKey === "markupPct") {
          row.markupPct = next === "" ? 0 : Math.max(0, toNumberOrZero(next));
        } else {
          row.unitCost = next === "" ? 0 : Math.max(0, toNumberOrZero(next));
        }
        const rowNode = target.closest("tr");
        const totalNode = rowNode?.querySelector("td:nth-child(6)");
        if (totalNode) {
          totalNode.textContent = fmtMoneyZero(computeExpenseRowTotal(row));
        }
      }
      renderComputed();
    });

    expenseRowsBody?.addEventListener("change", async (event) => {
      const target = event.target;
      const inputKey = String(target?.dataset?.expenseInput || "").trim();
      const rowId = String(target?.dataset?.expenseRowId || "").trim();
      if (!inputKey || !rowId) return;
      const row = planningExpenseRows.find((item) => String(item.id) === rowId);
      if (!row) return;
      if (inputKey === "billable") {
        const previousValue = row.billable === true;
        const nextValue = target.checked === true;
        row.billable = nextValue;
        renderComputed();
        const persisted = persistedExpenseFields.get(rowId) || {};
        if (expenseFieldValuesEqual("billable", persisted.billable, nextValue)) {
          return;
        }
        if (typeof onPersistExpenseField !== "function") {
          persistedExpenseFields.set(rowId, { ...persisted, billable: nextValue });
          return;
        }
        const requestKey = `${rowId}:billable`;
        const requestSeq = (expenseFieldRequestSeq.get(requestKey) || 0) + 1;
        expenseFieldRequestSeq.set(requestKey, requestSeq);
        try {
          await onPersistExpenseField({
            projectId: String(project?.id || "").trim(),
            expenseId: rowId,
            field: "billable",
            value: nextValue,
          });
          if ((expenseFieldRequestSeq.get(requestKey) || 0) !== requestSeq) {
            return;
          }
          const meta = expenseDraftMeta.get(rowId) || {};
          meta.customizedBillable = true;
          expenseDraftMeta.set(rowId, meta);
          persistedExpenseFields.set(rowId, { ...persisted, billable: nextValue });
        } catch (error) {
          if ((expenseFieldRequestSeq.get(requestKey) || 0) !== requestSeq) {
            return;
          }
          row.billable = previousValue;
          target.checked = previousValue;
          renderComputed();
        }
      } else if (inputKey === "categoryId") {
        const previousCategoryId = String(row.categoryId || "");
        const nextCategoryId = String(target.value || "");
        row.categoryId = nextCategoryId;
        const persisted = persistedExpenseFields.get(rowId) || {};
        const meta = expenseDraftMeta.get(rowId) || {
          isNew: false,
          customizedMarkupPct: false,
          customizedBillable: false,
        };
        const selectedCategory = projectExpenseCategories.find(
          (item) => String(item?.id || "").trim() === nextCategoryId
        );
        const hasDefaultBillable =
          typeof selectedCategory?.defaultBillable === "boolean" ||
          typeof selectedCategory?.default_billable === "boolean";
        const hasDefaultMarkup =
          selectedCategory?.defaultMarkupPct !== undefined ||
          selectedCategory?.default_markup_pct !== undefined;
        const nextDefaultBillable =
          typeof selectedCategory?.defaultBillable === "boolean"
            ? selectedCategory.defaultBillable
            : typeof selectedCategory?.default_billable === "boolean"
              ? selectedCategory.default_billable
              : row.billable;
        const nextDefaultMarkup = hasDefaultMarkup
          ? normalizeExpenseFieldValue(
              "markupPct",
              selectedCategory?.defaultMarkupPct ?? selectedCategory?.default_markup_pct
            )
          : row.markupPct;
        const shouldApplyDefaults = Boolean(meta.isNew);
        const applyBillable = shouldApplyDefaults && hasDefaultBillable && !meta.customizedBillable;
        const applyMarkup = shouldApplyDefaults && hasDefaultMarkup && !meta.customizedMarkupPct;
        const previousBillable = row.billable;
        const previousMarkup = row.markupPct;
        if (applyBillable) row.billable = nextDefaultBillable === true;
        if (applyMarkup) row.markupPct = nextDefaultMarkup;
        if (expenseFieldValuesEqual("categoryId", persisted.categoryId, nextCategoryId)) {
          if (applyBillable) {
            const checkbox = expenseRowsBody.querySelector(
              `input[data-expense-input="billable"][data-expense-row-id="${rowId}"]`
            );
            if (checkbox) checkbox.checked = row.billable;
          }
          if (applyMarkup) {
            const markupInput = expenseRowsBody.querySelector(
              `input[data-expense-input="markupPct"][data-expense-row-id="${rowId}"]`
            );
            if (markupInput) markupInput.value = String(row.markupPct);
          }
          renderComputed();
          return;
        }
        if (typeof onPersistExpenseField !== "function") {
          persistedExpenseFields.set(rowId, {
            ...persisted,
            categoryId: nextCategoryId,
            ...(applyBillable ? { billable: row.billable } : {}),
            ...(applyMarkup ? { markupPct: row.markupPct } : {}),
          });
          renderComputed();
          return;
        }
        target.disabled = true;
        try {
          await onPersistExpenseField({
            projectId: String(project?.id || "").trim(),
            expenseId: rowId,
            field: "categoryId",
            value: nextCategoryId,
          });
          const nextPersisted = {
            ...persisted,
            categoryId: nextCategoryId,
          };
          if (applyBillable) {
            await onPersistExpenseField({
              projectId: String(project?.id || "").trim(),
              expenseId: rowId,
              field: "billable",
              value: row.billable,
            });
            nextPersisted.billable = row.billable;
          }
          if (applyMarkup) {
            await onPersistExpenseField({
              projectId: String(project?.id || "").trim(),
              expenseId: rowId,
              field: "markupPct",
              value: row.markupPct,
            });
            nextPersisted.markupPct = row.markupPct;
          }
          persistedExpenseFields.set(rowId, nextPersisted);
          renderComputed();
        } catch (error) {
          row.categoryId = previousCategoryId;
          row.billable = previousBillable;
          row.markupPct = previousMarkup;
          target.value = previousCategoryId;
          const checkbox = expenseRowsBody.querySelector(
            `input[data-expense-input="billable"][data-expense-row-id="${rowId}"]`
          );
          if (checkbox) checkbox.checked = previousBillable;
          const markupInput = expenseRowsBody.querySelector(
            `input[data-expense-input="markupPct"][data-expense-row-id="${rowId}"]`
          );
          if (markupInput) markupInput.value = String(previousMarkup);
          renderComputed();
        } finally {
          target.disabled = false;
        }
      } else if (inputKey === "units") {
        const normalized = Math.max(0, Math.trunc(toNumberOrZero(target.value)));
        row.units = normalized;
        target.value = String(normalized);
      } else if (inputKey === "unitCost") {
        const normalized = Math.max(0, toNumberOrZero(target.value));
        row.unitCost = normalized;
        target.value = String(normalized);
      } else if (inputKey === "markupPct") {
        const normalized = Math.max(0, toNumberOrZero(target.value));
        row.markupPct = normalized;
        target.value = String(normalized);
        const meta = expenseDraftMeta.get(rowId) || {};
        meta.customizedMarkupPct = true;
        expenseDraftMeta.set(rowId, meta);
      }
    });

    expenseRowsBody?.addEventListener("focusout", async (event) => {
      const target = event.target;
      const inputKey = String(target?.dataset?.expenseInput || "").trim();
      const rowId = String(target?.dataset?.expenseRowId || "").trim();
      if (!inputKey || !rowId) return;
      if (
        inputKey !== "description" &&
        inputKey !== "units" &&
        inputKey !== "unitCost" &&
        inputKey !== "markupPct"
      ) {
        return;
      }
      const row = planningExpenseRows.find((item) => String(item.id) === rowId);
      if (!row) return;
      const persisted = persistedExpenseFields.get(rowId) || {};
      const nextValue = row[inputKey];
      const previousValue = persisted[inputKey];
      if (expenseFieldValuesEqual(inputKey, previousValue, nextValue)) return;
      if (typeof onPersistExpenseField !== "function") {
        persistedExpenseFields.set(rowId, { ...persisted, [inputKey]: normalizeExpenseFieldValue(inputKey, nextValue) });
        renderComputed();
        return;
      }
      target.disabled = true;
      try {
        await onPersistExpenseField({
          projectId: String(project?.id || "").trim(),
          expenseId: rowId,
          field: inputKey,
          value: normalizeExpenseFieldValue(inputKey, nextValue),
        });
        persistedExpenseFields.set(rowId, {
          ...persisted,
          [inputKey]: normalizeExpenseFieldValue(inputKey, nextValue),
        });
        if (inputKey === "markupPct") {
          const meta = expenseDraftMeta.get(rowId) || {};
          meta.customizedMarkupPct = true;
          expenseDraftMeta.set(rowId, meta);
        }
        renderComputed();
      } catch (error) {
        row[inputKey] = previousValue;
        if (inputKey === "description") {
          target.value = String(previousValue || "");
        } else {
          target.value = String(normalizeExpenseFieldValue(inputKey, previousValue));
          const rowNode = target.closest("tr");
          const totalNode = rowNode?.querySelector("td:nth-child(6)");
          if (totalNode) totalNode.textContent = fmtMoneyZero(computeExpenseRowTotal(row));
        }
        renderComputed();
      } finally {
        target.disabled = false;
      }
    });

    expenseRowsBody?.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest("[data-expense-delete]");
      if (!deleteButton) return;
      const rowId = String(deleteButton.dataset.expenseDelete || "").trim();
      if (!rowId) return;
      const rowIndex = planningExpenseRows.findIndex((item) => String(item.id) === rowId);
      const row = rowIndex >= 0 ? planningExpenseRows[rowIndex] : null;
      if (!row) return;
      const confirmed = window.confirm("Remove this expense?");
      if (!confirmed) return;
      const removedRow = { ...row };
      planningExpenseRows = planningExpenseRows.filter((item) => String(item.id) !== rowId);
      persistedExpenseFields.delete(rowId);
      expenseDraftMeta.delete(rowId);
      renderExpensesTable();
      renderComputed();
      try {
        if (typeof onDeleteExpenseRow === "function") {
          await onDeleteExpenseRow({
            projectId: String(project?.id || "").trim(),
            expenseId: rowId,
          });
        }
      } catch (error) {
        const nextRows = planningExpenseRows.slice();
        const restoreIndex = rowIndex >= 0 && rowIndex <= nextRows.length ? rowIndex : nextRows.length;
        nextRows.splice(restoreIndex, 0, removedRow);
        planningExpenseRows = nextRows;
        persistedExpenseFields.set(rowId, {
          categoryId: String(removedRow.categoryId || ""),
          description: String(removedRow.description || "").trim(),
          units: normalizeExpenseFieldValue("units", removedRow.units),
          unitCost: normalizeExpenseFieldValue("unitCost", removedRow.unitCost),
          markupPct: normalizeExpenseFieldValue("markupPct", removedRow.markupPct),
          billable: removedRow.billable === true,
        });
        expenseDraftMeta.set(rowId, {
          isNew: false,
          customizedMarkupPct: true,
          customizedBillable: true,
        });
        renderExpensesTable();
        renderComputed();
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert(error?.message || "Unable to remove expense row.");
        }
        return;
      }
    });

    renderExpensesTable();
    syncPlanningTab();

    addMemberButton?.addEventListener("click", () => {
      if (typeof onAddMember === "function") {
        onAddMember({
          projectId: String(project?.id || "").trim(),
          projectName: String(project?.name || "").trim(),
          clientName: String(project?.client || "").trim(),
        });
      }
    });

    const contractTypeButtons = Array.from(
      container.querySelectorAll("[data-contract-type-value]")
    );
    const syncContractTypeToggle = () => {
      contractTypeButtons.forEach((button) => {
        const value = String(button.dataset.contractTypeValue || "").trim();
        const isActive = value === contractType;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    };
    contractTypeButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const next = String(button.dataset.contractTypeValue || "").trim();
        if (next !== "fixed" && next !== "tm") return;
        if (next === contractType) return;
        const previous = contractType;
        contractType = next;
        syncContractTypeToggle();
        renderComputed();
        try {
          if (typeof onPersistContractType === "function") {
            await onPersistContractType({
              projectId: String(project?.id || "").trim(),
              contractType: next,
            });
          }
        } catch (error) {
          contractType = previous;
          syncContractTypeToggle();
          renderComputed();
        }
      });
    });
    syncContractTypeToggle();

    container.querySelectorAll("[data-row-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const rowId = String(button.dataset.rowDelete || "").trim();
        if (!rowId) return;
        const rowIndex = planningRows.findIndex((item) => String(item.id) === rowId);
        const row = rowIndex >= 0 ? planningRows[rowIndex] : null;
        if (!row || !row.canDelete) return;
        const confirmed = window.confirm("Remove this member?");
        if (!confirmed) return;
        const tbody = container.querySelector(".project-planning-table tbody");
        const rowEl = button.closest("tr");
        const nextSibling = rowEl?.nextElementSibling || null;
        const removedRow = { ...row };
        persistedRowFields.delete(rowId);
        planningRows = planningRows.filter((item) => String(item.id) !== rowId);
        rowEl?.remove();
        if (!planningRows.length && tbody) {
          tbody.innerHTML = `<tr><td colspan="8" class="project-planning-placeholder">No team budgeting rows yet.</td></tr>`;
        }
        renderComputed();
        try {
          if (typeof onDeleteMember === "function") {
            await onDeleteMember({
              projectId: String(project?.id || "").trim(),
              userId: String(row.userId || "").trim(),
              action: String(row.removeAction || "").trim().toLowerCase(),
            });
          }
        } catch (error) {
          const nextRows = planningRows.slice();
          const restoreIndex = rowIndex >= 0 && rowIndex <= nextRows.length ? rowIndex : nextRows.length;
          nextRows.splice(restoreIndex, 0, removedRow);
          planningRows = nextRows;
          persistedRowFields.set(rowId, {
            chargeRate: Number(removedRow.chargeRate) || 0,
            hours: Number(removedRow.hours) || 0,
          });
          if (tbody) {
            const placeholder = tbody.querySelector(".project-planning-placeholder")?.closest("tr");
            if (placeholder) placeholder.remove();
            if (rowEl) {
              const anchor = nextSibling && nextSibling.parentNode === tbody ? nextSibling : null;
              tbody.insertBefore(rowEl, anchor);
              const restoredButton = rowEl.querySelector("[data-row-delete]");
              if (restoredButton) restoredButton.disabled = false;
            }
          }
          renderComputed();
          return;
        }
      });
    });

    renderComputed();
  }

  window.projectPlanning = {
    renderProjectPlanningPage,
  };
})();
