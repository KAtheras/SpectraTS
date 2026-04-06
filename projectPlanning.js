(function () {
  const STYLE_ID = "project-planning-page-style";

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
      .project-planning-head h2 {
        margin: 0;
      }
      .project-planning-subtitle {
        margin: 4px 0 0;
        color: var(--muted);
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
      .project-planning-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
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
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 0;
      }
      .project-planning-kpi {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px 14px;
        background: var(--surface);
      }
      .project-planning-kpi-label {
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .project-planning-kpi-value {
        margin-top: 8px;
        font-size: 1.58rem;
        font-weight: 700;
        line-height: 1.2;
      }
      .project-planning-kpi.is-emphasis .project-planning-kpi-value {
        font-size: 1.66rem;
        font-weight: 800;
      }
      .project-planning-kpi-sub {
        margin-top: 8px;
        display: grid;
        gap: 4px;
      }
      .project-planning-kpi-subline {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: var(--muted);
        font-size: 0.82rem;
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
        cursor: text;
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
      .project-planning-table th:nth-child(8),
      .project-planning-table th:nth-child(9),
      .project-planning-table td:nth-child(6),
      .project-planning-table td:nth-child(7),
      .project-planning-table td:nth-child(8),
      .project-planning-table td:nth-child(9) {
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
      .project-planning-table input[data-row-input="costRate"],
      .project-planning-table input[data-row-input="chargeRate"],
      .project-planning-table input[data-row-input="hours"] {
        max-width: 96px;
      }
      .project-planning-table input[data-row-input="costRate"]::-webkit-outer-spin-button,
      .project-planning-table input[data-row-input="costRate"]::-webkit-inner-spin-button,
      .project-planning-table input[data-row-input="chargeRate"]::-webkit-outer-spin-button,
      .project-planning-table input[data-row-input="chargeRate"]::-webkit-inner-spin-button,
      .project-planning-table input[data-row-input="hours"]::-webkit-outer-spin-button,
      .project-planning-table input[data-row-input="hours"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .project-planning-table input[data-row-input="costRate"],
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
      const plannedCost = costRate * hours;
      const plannedRevenue = chargeRate * hours;
      const margin = plannedRevenue - plannedCost;
      const marginPercent = plannedRevenue > 0 ? (margin / plannedRevenue) * 100 : 0;
      return {
        ...row,
        hours,
        costRate,
        chargeRate,
        plannedCost,
        plannedRevenue,
        margin,
        marginPercent,
      };
    });
  }

  function computeTotals(rows, contractAmount, overheadPercent) {
    const totalHours = rows.reduce((sum, row) => sum + toNumberOrZero(row.hours), 0);
    const directCost = rows.reduce((sum, row) => sum + toNumberOrZero(row.plannedCost), 0);
    const plannedRevenueTotal = rows.reduce((sum, row) => sum + toNumberOrZero(row.plannedRevenue), 0);
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
      overheadCost,
      totalCost,
      grossMargin,
      marginPercent,
      hasContract,
    };
  }

  function fmtProjectType(value) {
    if (value === "time_and_materials") return "Time & Materials";
    if (value === "fixed_fee") return "Fixed Fee";
    return "—";
  }

  function renderProjectPlanningPage({ projectId, state, container, onBack, onSave }) {
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
    const typeValue = project?.pricingModel ?? project?.pricing_model ?? null;
    const subtitle = `${clientName} / ${projectName} · ${fmtProjectType(typeValue)}`;
    const leadName = String(
      project?.projectLeadName ||
        usersById.get(String(project?.projectLeadId || project?.project_lead_id || "").trim())?.displayName ||
        "Unassigned"
    );
    const overheadValue = toNullableNumber(project?.overheadPercent ?? project?.overhead_percent);
    let contractAmountValue = toNullableNumber(project?.contractAmount ?? project?.contract_amount);
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
        costRate: costRate ?? baseRate ?? 0,
        chargeRate: budgetRateOverride ?? chargeRateOverride ?? baseRate ?? 0,
        hours: toNullableNumber(budgetRow?.budgetHours) ?? 0,
      };
    });
    planningRows = computeRows(planningRows);
    const initialTotals = computeTotals(planningRows, contractAmountValue, overheadValue);

    container.innerHTML = `
      <section class="page-view project-planning-page" aria-labelledby="project-planning-title">
        <header class="project-planning-head">
          <div>
            <h2 id="project-planning-title">Project Planning</h2>
            <p class="project-planning-subtitle">${escapeHtml(subtitle)}</p>
          </div>
          <div class="project-planning-actions">
            <button type="button" class="button" data-project-planning-save>Save Plan</button>
            <button type="button" class="button button-ghost" data-project-planning-back>Back</button>
          </div>
        </header>
        <section class="project-planning-kpi-row">
            <section class="project-planning-kpis">
              <article class="project-planning-kpi" data-kpi-card="contract">
                <div class="project-planning-kpi-label">Contract Amount</div>
                <div class="project-planning-kpi-value" data-kpi="contract">${escapeHtml(fmtMoneyZero(contractAmountValue))}</div>
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
                <div class="project-planning-kpi-value" data-kpi="grossMargin">${escapeHtml(initialTotals.hasContract ? fmtMoneyZero(initialTotals.grossMargin) : "—")}</div>
                <div class="project-planning-kpi-sub">
                  <div class="project-planning-kpi-subline">
                    <span>Contract</span>
                    <strong data-kpi="grossContract">${escapeHtml(fmtMoneyZero(contractAmountValue))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline">
                    <span>Cost</span>
                    <strong data-kpi="grossCost">${escapeHtml(fmtMoneyZero(initialTotals.totalCost))}</strong>
                  </div>
                </div>
              </article>
              <article class="project-planning-kpi is-emphasis">
                <div class="project-planning-kpi-label">Realization</div>
                <div class="project-planning-kpi-value" data-kpi="realizationPct">${escapeHtml(initialTotals.hasContract && initialTotals.plannedRevenueTotal > 0 ? fmtPercent((contractAmountValue / initialTotals.plannedRevenueTotal) * 100) : "—")}</div>
                <div class="project-planning-kpi-sub">
                  <div class="project-planning-kpi-subline">
                    <span>Std Rev</span>
                    <strong data-kpi="standardRevenue">${escapeHtml(fmtMoneyZero(initialTotals.plannedRevenueTotal))}</strong>
                  </div>
                  <div class="project-planning-kpi-subline ${initialTotals.hasContract && contractAmountValue - initialTotals.plannedRevenueTotal < 0 ? "is-negative" : "is-positive"}">
                    <span data-kpi-label="premiumDiscount">${initialTotals.hasContract && contractAmountValue < initialTotals.plannedRevenueTotal ? "Discount" : "Premium"}</span>
                    <strong data-kpi="premiumDiscount">${escapeHtml(initialTotals.hasContract ? fmtMoney(contractAmountValue - initialTotals.plannedRevenueTotal) : "—")}</strong>
                  </div>
                </div>
              </article>
            </section>
        </section>
        <div class="project-planning-layout project-planning-body">
          <main>
            <section class="project-planning-block project-planning-table-card">
              <h3>Team Budgeting</h3>
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
                      <th>Margin</th>
                      <th>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      planningRows.length
                        ? planningRows
                            .map((row) => {
                              return `
                                <tr>
                                  <td>${escapeHtml(row.memberName)}</td>
                                  <td>${escapeHtml(String(row.role).replace(/_/g, " "))}</td>
                                  <td><input class="project-planning-input" type="number" min="0" step="0.01" data-row-input="costRate" data-row-id="${escapeHtml(row.id)}" value="${escapeHtml(row.costRate)}" /></td>
                                  <td><input class="project-planning-input" type="number" min="0" step="0.01" data-row-input="chargeRate" data-row-id="${escapeHtml(row.id)}" value="${escapeHtml(row.chargeRate)}" /></td>
                                  <td><input class="project-planning-input" type="number" min="0" step="0.25" data-row-input="hours" data-row-id="${escapeHtml(row.id)}" value="${escapeHtml(row.hours)}" /></td>
                                  <td data-row-output="cost" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtMoneyZero(row.plannedCost))}</td>
                                  <td data-row-output="revenue" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtMoneyZero(row.plannedRevenue))}</td>
                                  <td data-row-output="margin" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtMoneyZero(row.margin))}</td>
                                  <td data-row-output="marginPct" data-row-id="${escapeHtml(row.id)}">${escapeHtml(fmtPercentZero(row.marginPercent))}</td>
                                </tr>
                              `;
                            })
                            .join("")
                        : `
                          <tr>
                            <td colspan="9" class="project-planning-placeholder">No team budgeting rows yet.</td>
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
                  <span class="project-planning-econ-label">Contract Amount</span>
                  <span class="project-planning-econ-value" data-econ="contractAmount">${escapeHtml(fmtMoneyZero(contractAmountValue))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Planned Revenue</span>
                  <span class="project-planning-econ-value" data-econ="plannedRevenue">${escapeHtml(fmtMoneyZero(initialTotals.plannedRevenueTotal))}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label" data-econ-label="discountPremium">
                    ${initialTotals.hasContract && contractAmountValue - initialTotals.plannedRevenueTotal >= 0
                      ? "Premium to Standard Rates"
                      : "Discount to Standard Rates"}
                  </span>
                  <span class="project-planning-econ-value" data-econ="discountPremium">
                    ${escapeHtml(initialTotals.hasContract ? fmtMoney(contractAmountValue - initialTotals.plannedRevenueTotal) : "—")}
                  </span>
                </div>
              </section>
              <section class="project-planning-econ-section">
                <div class="project-planning-econ-title">Costs</div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Direct Labor Cost</span>
                  <span class="project-planning-econ-value" data-econ="directCost">${escapeHtml(fmtMoneyZero(initialTotals.directCost))}</span>
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
                  <span class="project-planning-econ-value" data-econ="grossMargin">${escapeHtml(initialTotals.hasContract ? fmtMoney(initialTotals.grossMargin) : "—")}</span>
                </div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Gross Margin %</span>
                  <span class="project-planning-econ-value" data-econ="grossMarginPct">${escapeHtml(initialTotals.hasContract ? fmtPercent(initialTotals.marginPercent) : "—")}</span>
                </div>
              </section>
              <section class="project-planning-econ-section">
                <div class="project-planning-econ-title">Implied Metrics</div>
                <div class="project-planning-econ-row">
                  <span class="project-planning-econ-label">Implied Rate</span>
                  <span class="project-planning-econ-value" data-econ="impliedRate">${escapeHtml(initialTotals.hasContract && initialTotals.totalHours > 0 ? fmtMoney(contractAmountValue / initialTotals.totalHours) : "—")}</span>
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

    const kpiContractNode = container.querySelector('[data-kpi="contract"]');
    const kpiPlannedCostNode = container.querySelector('[data-kpi="plannedCost"]');
    const kpiPlannedDirectNode = container.querySelector('[data-kpi="plannedDirect"]');
    const kpiPlannedOverheadNode = container.querySelector('[data-kpi="plannedOverhead"]');
    const kpiGrossMarginNode = container.querySelector('[data-kpi="grossMargin"]');
    const kpiGrossContractNode = container.querySelector('[data-kpi="grossContract"]');
    const kpiGrossCostNode = container.querySelector('[data-kpi="grossCost"]');
    const kpiRealizationPctNode = container.querySelector('[data-kpi="realizationPct"]');
    const kpiStandardRevenueNode = container.querySelector('[data-kpi="standardRevenue"]');
    const kpiPremiumDiscountNode = container.querySelector('[data-kpi="premiumDiscount"]');
    const kpiPremiumDiscountLabelNode = container.querySelector('[data-kpi-label="premiumDiscount"]');
    const contractCardNode = container.querySelector('[data-kpi-card="contract"]');
    const econContractNode = container.querySelector('[data-econ="contractAmount"]');
    const econPlannedRevenueNode = container.querySelector('[data-econ="plannedRevenue"]');
    const econDiscountPremiumNode = container.querySelector('[data-econ="discountPremium"]');
    const econDiscountPremiumLabelNode = container.querySelector('[data-econ-label="discountPremium"]');
    const econDirectCostNode = container.querySelector('[data-econ="directCost"]');
    const econOverheadCostNode = container.querySelector('[data-econ="overheadCost"]');
    const econTotalCostNode = container.querySelector('[data-econ="totalCost"]');
    const econGrossMarginNode = container.querySelector('[data-econ="grossMargin"]');
    const econGrossMarginPctNode = container.querySelector('[data-econ="grossMarginPct"]');
    const econImpliedRateNode = container.querySelector('[data-econ="impliedRate"]');
    let isEditingContractAmount = false;

    function commitContractAmount(rawValue) {
      const trimmed = String(rawValue ?? "").trim();
      if (!trimmed) {
        contractAmountValue = null;
        isEditingContractAmount = false;
        renderComputed();
        return;
      }
      const numeric = Number(trimmed.replace(/,/g, "").replace(/[^\d.-]/g, ""));
      if (Number.isFinite(numeric)) {
        contractAmountValue = numeric;
      }
      isEditingContractAmount = false;
      renderComputed();
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
      editInput.addEventListener("blur", () => commitContractAmount(editInput.value));
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
      const realizationPct =
        totals.plannedRevenueTotal > 0 && Number.isFinite(contractAmountValue)
          ? (contractAmountValue / totals.plannedRevenueTotal) * 100
          : null;

      planningRows.forEach((row) => {
        const rowId = String(row.id);
        const costNode = container.querySelector(`[data-row-output="cost"][data-row-id="${rowId}"]`);
        const revenueNode = container.querySelector(`[data-row-output="revenue"][data-row-id="${rowId}"]`);
        const marginNode = container.querySelector(`[data-row-output="margin"][data-row-id="${rowId}"]`);
        const marginPctNode = container.querySelector(`[data-row-output="marginPct"][data-row-id="${rowId}"]`);
        if (costNode) costNode.textContent = fmtMoneyZero(row.plannedCost);
        if (revenueNode) revenueNode.textContent = fmtMoneyZero(row.plannedRevenue);
        if (marginNode) marginNode.textContent = fmtMoneyZero(row.margin);
        if (marginPctNode) marginPctNode.textContent = fmtPercentZero(row.marginPercent);
      });

      if (kpiContractNode && !isEditingContractAmount) kpiContractNode.textContent = fmtMoneyZero(contractAmountValue);
      if (kpiPlannedCostNode) kpiPlannedCostNode.textContent = fmtMoneyZero(totals.totalCost);
      if (kpiPlannedDirectNode) kpiPlannedDirectNode.textContent = fmtMoneyZero(totals.directCost);
      if (kpiPlannedOverheadNode) kpiPlannedOverheadNode.textContent = fmtMoneyZero(totals.overheadCost);
      if (kpiGrossMarginNode) kpiGrossMarginNode.textContent = totals.hasContract ? fmtMoneyZero(totals.grossMargin) : "—";
      if (kpiGrossContractNode) kpiGrossContractNode.textContent = fmtMoneyZero(contractAmountValue);
      if (kpiGrossCostNode) kpiGrossCostNode.textContent = fmtMoneyZero(totals.totalCost);
      if (kpiRealizationPctNode) kpiRealizationPctNode.textContent = realizationPct === null ? "—" : fmtPercent(realizationPct);
      if (kpiStandardRevenueNode) kpiStandardRevenueNode.textContent = fmtMoneyZero(totals.plannedRevenueTotal);
      const discountPremiumValue = totals.hasContract ? contractAmountValue - totals.plannedRevenueTotal : null;
      if (kpiPremiumDiscountLabelNode) {
        kpiPremiumDiscountLabelNode.textContent =
          totals.hasContract && Number.isFinite(discountPremiumValue) && discountPremiumValue < 0
            ? "Discount"
            : "Premium";
      }
      if (kpiPremiumDiscountNode) {
        kpiPremiumDiscountNode.textContent = totals.hasContract ? fmtMoney(discountPremiumValue) : "—";
        kpiPremiumDiscountNode.parentElement?.classList.remove("is-positive", "is-negative");
        if (totals.hasContract && Number.isFinite(discountPremiumValue)) {
          if (discountPremiumValue < 0) kpiPremiumDiscountNode.parentElement?.classList.add("is-negative");
          if (discountPremiumValue > 0) kpiPremiumDiscountNode.parentElement?.classList.add("is-positive");
        }
      }
      if (econContractNode) econContractNode.textContent = fmtMoneyZero(contractAmountValue);
      if (econPlannedRevenueNode) econPlannedRevenueNode.textContent = fmtMoneyZero(totals.plannedRevenueTotal);
      if (econDiscountPremiumLabelNode) {
        econDiscountPremiumLabelNode.textContent =
          totals.hasContract && Number.isFinite(discountPremiumValue) && discountPremiumValue >= 0
            ? "Premium to Standard Rates"
            : "Discount to Standard Rates";
      }
      if (econDiscountPremiumNode) {
        econDiscountPremiumNode.textContent = totals.hasContract ? fmtMoney(discountPremiumValue) : "—";
        setEconomicSignal(econDiscountPremiumNode, discountPremiumValue, {
          negativeIsDanger: true,
          positiveIsSuccess: true,
        });
      }
      if (econDirectCostNode) econDirectCostNode.textContent = fmtMoneyZero(totals.directCost);
      if (econOverheadCostNode) econOverheadCostNode.textContent = fmtMoneyZero(totals.overheadCost);
      if (econTotalCostNode) econTotalCostNode.textContent = fmtMoneyZero(totals.totalCost);
      if (econGrossMarginNode) {
        econGrossMarginNode.textContent = totals.hasContract ? fmtMoney(totals.grossMargin) : "—";
        setEconomicSignal(econGrossMarginNode, totals.grossMargin, {
          negativeIsDanger: true,
          positiveIsSuccess: true,
        });
      }
      if (econGrossMarginPctNode) {
        econGrossMarginPctNode.textContent = totals.hasContract ? fmtPercent(totals.marginPercent) : "—";
        setEconomicSignal(econGrossMarginPctNode, totals.marginPercent, {
          negativeIsDanger: true,
          positiveIsSuccess: true,
        });
      }
      if (econImpliedRateNode) {
        const impliedRate = totals.hasContract && totals.totalHours > 0 ? contractAmountValue / totals.totalHours : null;
        econImpliedRateNode.textContent = impliedRate === null ? "—" : fmtMoney(impliedRate);
      }

    }

    kpiContractNode?.addEventListener("click", (event) => {
      if (event.target && event.target.closest("[data-contract-edit-input]")) return;
      enterContractAmountEditMode();
    });

    container.querySelectorAll("[data-row-input]").forEach((input) => {
      input.addEventListener("input", (event) => {
        const target = event.target;
        const rowId = String(target?.dataset?.rowId || "");
        const field = String(target?.dataset?.rowInput || "");
        if (!rowId || !field) return;
        const row = planningRows.find((item) => String(item.id) === rowId);
        if (!row) return;
        const raw = String(target.value || "").trim();
        row[field] = raw === "" ? null : toNumberOrZero(raw);
        renderComputed();
      });
    });

    renderComputed();
  }

  window.projectPlanning = {
    renderProjectPlanningPage,
  };
})();
