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
        color: var(--muted);
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
        border-radius: 10px;
        overflow: hidden;
        background: var(--surface);
      }
      .project-planning-contract-type-option {
        border: 0;
        border-right: 1px solid var(--line);
        background: transparent;
        color: var(--muted);
        padding: 7px 12px;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
      }
      .project-planning-contract-type-option:last-child {
        border-right: 0;
      }
      .project-planning-contract-type-option.is-active {
        background: var(--surface-strong);
        color: var(--text);
      }
      .project-planning-layout {
        display: grid;
        grid-template-columns: minmax(0, 73%) minmax(0, 27%);
        gap: 12px;
        align-items: stretch;
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
      .project-planning-kpi[data-kpi-card="contract"] .project-planning-kpi-value {
        cursor: pointer;
      }
      .project-planning-kpi[data-kpi-card="contract"] {
        position: relative;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;
      }
      .project-planning-kpi[data-kpi-card="contract"]:hover {
        border-color: color-mix(in srgb, var(--accent), var(--line) 62%);
        background: color-mix(in srgb, var(--surface), var(--accent) 4%);
      }
      .project-planning-kpi-edit-icon {
        position: absolute;
        top: 11px;
        right: 12px;
        color: var(--muted);
        font-size: 0.86rem;
        line-height: 1;
        pointer-events: none;
        transition: color 0.15s ease;
      }
      .project-planning-kpi[data-kpi-card="contract"]:hover .project-planning-kpi-edit-icon {
        color: var(--text);
      }
      .project-planning-kpi-edit-hint {
        margin-top: 5px;
        color: color-mix(in srgb, var(--muted) 90%, transparent);
        font-size: 0.72rem;
        line-height: 1.2;
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
      }
      .project-planning-table-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0 0 10px;
      }
      .project-planning-table-head h3 {
        margin: 0;
      }
      .project-planning-table-wrap {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: auto;
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

  function renderProjectPlanningPage({ projectId, state, container, onBack, onSave, onAddMember, onPersistField, onDeleteMember, onPersistContractType, onPersistContractAmount }) {
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
    const initialTotals = computeTotals(planningRows, contractAmountValue, overheadValue);
    const initialIsTmContract = contractType === "tm";
    const initialGrossTopLineValue = initialIsTmContract
      ? initialTotals.plannedRevenueTotal
      : contractAmountValue;
    const initialGrossMarginValue = Number.isFinite(initialGrossTopLineValue)
      ? initialGrossTopLineValue - initialTotals.totalCost
      : null;
    const initialGrossMarginPct = Number.isFinite(initialGrossTopLineValue) && initialGrossTopLineValue > 0
      ? (initialGrossMarginValue / initialGrossTopLineValue) * 100
      : null;
    const initialRealizationNumerator = initialIsTmContract
      ? initialTotals.plannedRevenueTotal
      : contractAmountValue;
    const initialDiscountPremiumValue = Number.isFinite(initialRealizationNumerator)
      ? initialRealizationNumerator - initialTotals.standardRevenueTotal
      : null;

    container.innerHTML = `
      <section class="page-view project-planning-page" aria-labelledby="project-planning-title">
        <header class="project-planning-head">
          <div class="project-planning-head-main">
            <h2 id="project-planning-title">Project Planning</h2>
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
                <div class="project-planning-kpi-label" data-kpi-label="contractPrimary">Contract Amount</div>
                <span class="project-planning-kpi-edit-icon" data-kpi="contractEditIcon" aria-hidden="true">✎</span>
                <div class="project-planning-kpi-value" data-kpi="contract">${escapeHtml(fmtMoneyZero(contractAmountValue))}</div>
                <div class="project-planning-kpi-edit-hint" data-kpi="contractEditHint">Click to edit</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Planned Cost</div>
                <div class="project-planning-kpi-value" data-kpi="plannedCost">${escapeHtml(fmtMoneyZero(initialTotals.totalCost))}</div>
                <div class="project-planning-kpi-sub">
                  <div class="project-planning-kpi-subline">
                    <span>Direct</span>
                    <strong data-kpi="plannedDirect">${escapeHtml(fmtMoneyZero(initialTotals.directCost))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline">
                    <span>Overhead</span>
                    <strong data-kpi="plannedOverhead">${escapeHtml(fmtMoneyZero(initialTotals.overheadCost))}</strong>
                  </div>
                </div>
              </article>
              <article class="project-planning-kpi is-emphasis">
                <div class="project-planning-kpi-label">Gross Margin</div>
                <div class="project-planning-kpi-value" data-kpi="grossMargin">${escapeHtml(Number.isFinite(initialGrossMarginValue) ? fmtMoneyZero(initialGrossMarginValue) : "—")}</div>
                <div class="project-planning-kpi-sub">
                  <div class="project-planning-kpi-subline">
                    <span data-kpi-label="grossTopLine">${initialIsTmContract ? "Revenue" : "Contract"}</span>
                    <strong data-kpi="grossContract">${escapeHtml(fmtMoneyZero(initialGrossTopLineValue))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline">
                    <span>Cost</span>
                    <strong data-kpi="grossCost">${escapeHtml(fmtMoneyZero(initialTotals.totalCost))}</strong>
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
                <h3>Team Budgeting</h3>
                <button type="button" class="button button-ghost" data-project-planning-add-member>Add Member</button>
              </div>
              <div class="project-planning-table-wrap">
                <table class="project-planning-table">
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
                  <span class="project-planning-econ-label" data-econ-label="revenueSecondary">${initialIsTmContract ? "Expense Revenue" : "Standard Revenue"}</span>
                  <span class="project-planning-econ-value" data-econ="revenueSecondary">${escapeHtml(initialIsTmContract ? fmtMoneyZero(0) : fmtMoneyZero(initialTotals.standardRevenueTotal))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label" data-econ-label="revenueTertiary">
                    ${initialIsTmContract
                      ? "Total Revenue"
                      : "Variance to Standard"}
                  </span>
                  <span class="project-planning-econ-value" data-econ="revenueTertiary">
                    ${escapeHtml(
                      initialIsTmContract
                        ? fmtMoneyZero(initialTotals.plannedRevenueTotal)
                        : Number.isFinite(contractAmountValue)
                          ? fmtMoney(contractAmountValue - initialTotals.standardRevenueTotal)
                          : "—"
                    )}
                  </span>
                </div>
              </section>
              <section class="project-planning-econ-section">
                <div class="project-planning-econ-title">Costs</div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Direct Labor Cost</span>
                  <span class="project-planning-econ-value" data-econ="directCost">${escapeHtml(fmtMoneyZero(initialTotals.directCost))}</span>
                </div>
                <div class="project-planning-econ-row" data-econ-row="expenseCost" ${initialIsTmContract ? "" : "hidden"}>
                  <span class="project-planning-econ-label">Expense Cost</span>
                  <span class="project-planning-econ-value" data-econ="expenseCost">${escapeHtml(fmtMoneyZero(0))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Overhead</span>
                  <span class="project-planning-econ-value" data-econ="overheadCost">${escapeHtml(fmtMoneyZero(initialTotals.overheadCost))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Total Cost</span>
                  <span class="project-planning-econ-value" data-econ="totalCost">${escapeHtml(fmtMoneyZero(initialTotals.totalCost))}</span>
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
    const kpiContractEditIconNode = container.querySelector('[data-kpi="contractEditIcon"]');
    const kpiContractEditHintNode = container.querySelector('[data-kpi="contractEditHint"]');
    const contractCardNode = container.querySelector('[data-kpi-card="contract"]');
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
      if (!kpiContractNode || isEditingContractAmount) return;
      isEditingContractAmount = true;
      const currentRaw = contractAmountValue === null || contractAmountValue === undefined
        ? ""
        : String(Number(contractAmountValue));
      kpiContractNode.innerHTML = `<input class="project-planning-kpi-edit-input" type="text" inputmode="decimal" value="${escapeHtml(currentRaw)}" data-contract-edit-input />`;
      const editInput = kpiContractNode.querySelector("[data-contract-edit-input]");
      if (!editInput) return;
      editInput.focus();
      editInput.select();
      editInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          editInput.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          isEditingContractAmount = false;
          renderComputed();
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
      const isTmContract = contractType === "tm";
      const grossTopLineValue = isTmContract ? totals.plannedRevenueTotal : contractAmountValue;
      const expenseRevenueTotal = 0;
      const expenseCostTotal = 0;
      const totalRevenueValue = totals.plannedRevenueTotal + expenseRevenueTotal;
      const totalCostValue = totals.totalCost + expenseCostTotal;
      const grossMarginValue = Number.isFinite(grossTopLineValue)
        ? (isTmContract ? totalRevenueValue : grossTopLineValue) - totalCostValue
        : null;
      const grossMarginPctDenominator = isTmContract ? totalRevenueValue : grossTopLineValue;
      const grossMarginPct = Number.isFinite(grossMarginPctDenominator) && grossMarginPctDenominator > 0
        ? (grossMarginValue / grossMarginPctDenominator) * 100
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
        kpiContractLabelNode.textContent = isTmContract ? "Planned Revenue" : "Contract Amount";
      }
      if (kpiContractEditIconNode) {
        kpiContractEditIconNode.hidden = isTmContract;
      }
      if (kpiContractEditHintNode) {
        kpiContractEditHintNode.hidden = isTmContract;
      }
      if (kpiContractNode && !isEditingContractAmount) {
        kpiContractNode.textContent = isTmContract
          ? fmtMoneyZero(totals.plannedRevenueTotal)
          : fmtMoneyZero(contractAmountValue);
      }
      if (kpiPlannedCostNode) kpiPlannedCostNode.textContent = fmtMoneyZero(totals.totalCost);
      if (kpiPlannedDirectNode) kpiPlannedDirectNode.textContent = fmtMoneyZero(totals.directCost);
      if (kpiPlannedOverheadNode) kpiPlannedOverheadNode.textContent = fmtMoneyZero(totals.overheadCost);
      if (kpiGrossMarginNode) kpiGrossMarginNode.textContent = Number.isFinite(grossMarginValue) ? fmtMoneyZero(grossMarginValue) : "—";
      if (kpiGrossTopLineLabelNode) {
        kpiGrossTopLineLabelNode.textContent = isTmContract ? "Revenue" : "Contract";
      }
      if (kpiGrossContractNode) {
        kpiGrossContractNode.textContent = isTmContract
          ? fmtMoneyZero(totals.plannedRevenueTotal)
          : fmtMoneyZero(contractAmountValue);
      }
      if (kpiGrossCostNode) kpiGrossCostNode.textContent = fmtMoneyZero(totals.totalCost);
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
      if (econRevenueSecondaryLabelNode) econRevenueSecondaryLabelNode.textContent = isTmContract ? "Expense Revenue" : "Standard Revenue";
      if (econRevenueTertiaryLabelNode) {
        econRevenueTertiaryLabelNode.textContent = isTmContract
          ? "Total Revenue"
          : "Variance to Standard";
      }
      if (econRevenuePrimaryNode) {
        econRevenuePrimaryNode.textContent = isTmContract ? fmtMoneyZero(totals.plannedRevenueTotal) : fmtMoneyZero(contractAmountValue);
      }
      if (econRevenueSecondaryNode) {
        econRevenueSecondaryNode.textContent = isTmContract ? fmtMoneyZero(expenseRevenueTotal) : fmtMoneyZero(totals.standardRevenueTotal);
      }
      if (econRevenueTertiaryNode) {
        if (isTmContract) {
          econRevenueTertiaryNode.textContent = fmtMoneyZero(totalRevenueValue);
          econRevenueTertiaryNode.classList.remove("is-negative", "is-positive");
        } else {
          econRevenueTertiaryNode.textContent = Number.isFinite(discountPremiumValue) ? fmtMoney(discountPremiumValue) : "—";
          setEconomicSignal(econRevenueTertiaryNode, discountPremiumValue, {
            negativeIsDanger: true,
            positiveIsSuccess: true,
          });
        }
      }
      if (econDirectCostNode) econDirectCostNode.textContent = fmtMoneyZero(totals.directCost);
      if (econExpenseCostRowNode) econExpenseCostRowNode.hidden = !isTmContract;
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

    contractCardNode?.addEventListener("click", (event) => {
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
        const row = planningRows.find((item) => String(item.id) === rowId);
        if (!row || !row.canDelete) return;
        const confirmed = window.confirm("Remove this member?");
        if (!confirmed) return;
        button.disabled = true;
        try {
          if (typeof onDeleteMember === "function") {
            await onDeleteMember({
              projectId: String(project?.id || "").trim(),
              userId: String(row.userId || "").trim(),
              action: String(row.removeAction || "").trim().toLowerCase(),
            });
          }
        } catch (error) {
          button.disabled = false;
          return;
        }
        persistedRowFields.delete(rowId);
        planningRows = planningRows.filter((item) => String(item.id) !== rowId);
        const rowEl = button.closest("tr");
        rowEl?.remove();
        if (!planningRows.length) {
          const tbody = container.querySelector(".project-planning-table tbody");
          if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="project-planning-placeholder">No team budgeting rows yet.</td></tr>`;
          }
        }
        renderComputed();
      });
    });

    renderComputed();
  }

  window.projectPlanning = {
    renderProjectPlanningPage,
  };
})();
