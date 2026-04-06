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
      .project-planning-layout {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr) 280px;
        gap: 16px;
        align-items: start;
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 12px;
      }
      .project-planning-kpi {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px;
        background: var(--surface);
      }
      .project-planning-kpi-label {
        color: var(--muted);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .project-planning-kpi-value {
        margin-top: 6px;
        font-size: 1.12rem;
        font-weight: 700;
      }
      .project-planning-sidebar {
        display: grid;
        gap: 12px;
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
      .project-planning-table-wrap {
        overflow: auto;
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
      }
      .project-planning-table th {
        color: var(--muted);
        font-size: .76rem;
        text-transform: uppercase;
        letter-spacing: .04em;
      }
      .project-planning-right {
        display: grid;
        gap: 10px;
      }
      .project-planning-chart {
        min-height: 108px;
        display: grid;
        align-content: start;
        gap: 6px;
      }
      .project-planning-chart h4 {
        margin: 0;
      }
      .project-planning-placeholder {
        color: var(--muted);
        font-size: .9rem;
      }
      .project-planning-input {
        width: 100%;
        min-width: 88px;
      }
      .project-planning-consumption {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px;
        background: var(--surface);
        margin-bottom: 12px;
        display: grid;
        gap: 8px;
      }
      .project-planning-consumption-track {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: rgba(120, 120, 120, 0.18);
        overflow: hidden;
      }
      .project-planning-consumption-fill {
        height: 100%;
        width: 0%;
        background: var(--accent);
        transition: width 0.15s ease;
      }
      .project-planning-consumption-label {
        color: var(--muted);
        font-size: 0.84rem;
      }
      @media (max-width: 1200px) {
        .project-planning-layout {
          grid-template-columns: 1fr;
        }
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
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  }

  function fmtMoneyZero(value) {
    const num = Number(value);
    const safe = Number.isFinite(num) ? num : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  }

  function fmtPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${num.toFixed(2)}%`;
  }

  function fmtPercentZero(value) {
    const num = Number(value);
    const safe = Number.isFinite(num) ? num : 0;
    return `${safe.toFixed(2)}%`;
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
    const typeValue = project?.pricingModel ?? project?.pricing_model ?? null;
    const overheadValue = toNullableNumber(project?.overheadPercent ?? project?.overhead_percent);
    const contractAmount = toNullableNumber(project?.contractAmount ?? project?.contract_amount);
    const budgetAmount = toNullableNumber(project?.budget);
    const memberBudgets = Array.isArray(state?.projectMemberBudgets)
      ? state.projectMemberBudgets.filter(
          (row) => String(row?.projectId || "").trim() === String(project?.id || "").trim()
        )
      : [];
    const budgetByUserId = new Map(
      memberBudgets.map((row) => [String(row?.userId || "").trim(), row])
    );
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
      const roleLabel =
        userId === leadUserId
          ? "Project Lead"
          : managerIds.has(userId)
            ? "Manager"
            : (member?.permissionGroup || member?.permission_group || "Staff");
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
    const initialTotals = computeTotals(planningRows, contractAmount, overheadValue);

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
        <div class="project-planning-layout">
          <aside class="project-planning-sidebar">
            <section class="project-planning-block">
              <h3>Project Basics</h3>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Project Name</span>
                <span class="project-planning-field-value">${escapeHtml(projectName)}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Client</span>
                <span class="project-planning-field-value">${escapeHtml(clientName)}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Project Lead</span>
                <span class="project-planning-field-value">${escapeHtml(leadName || "Unassigned")}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Project Type</span>
                <span class="project-planning-field-value">${escapeHtml(fmtProjectType(typeValue))}</span>
              </div>
            </section>
            <section class="project-planning-block">
              <h3>Pricing Inputs</h3>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Contract Amount</span>
                <span class="project-planning-field-value">${escapeHtml(fmtMoneyZero(contractAmount))}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Budget</span>
                <span class="project-planning-field-value">${escapeHtml(fmtMoneyZero(budgetAmount))}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Overhead %</span>
                <span class="project-planning-field-value">${escapeHtml(fmtPercentZero(overheadValue))}</span>
              </div>
            </section>
          </aside>
          <main>
            <section class="project-planning-kpis">
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Contract Amount</div>
                <div class="project-planning-kpi-value" data-kpi="contract">${escapeHtml(fmtMoneyZero(contractAmount))}</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Budget</div>
                <div class="project-planning-kpi-value" data-kpi="budget">${escapeHtml(fmtMoneyZero(budgetAmount))}</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Planned Cost</div>
                <div class="project-planning-kpi-value" data-kpi="plannedCost">${escapeHtml(fmtMoneyZero(initialTotals.totalCost))}</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Gross Margin</div>
                <div class="project-planning-kpi-value" data-kpi="grossMargin">${escapeHtml(initialTotals.hasContract ? fmtMoneyZero(initialTotals.grossMargin) : "—")}</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Margin %</div>
                <div class="project-planning-kpi-value" data-kpi="marginPct">${escapeHtml(initialTotals.hasContract ? fmtPercent(initialTotals.marginPercent) : "—")}</div>
              </article>
              <article class="project-planning-kpi">
                <div class="project-planning-kpi-label">Planned Hours</div>
                <div class="project-planning-kpi-value" data-kpi="hours">${escapeHtml(initialTotals.totalHours.toFixed(2))}</div>
              </article>
            </section>
            <section class="project-planning-consumption" data-consumption-wrap ${initialTotals.hasContract ? "" : "hidden"}>
              <div class="project-planning-consumption-track">
                <div class="project-planning-consumption-fill" data-consumption-fill></div>
              </div>
              <div class="project-planning-consumption-label" data-consumption-label></div>
            </section>
            <section class="project-planning-block">
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
            <section class="project-planning-block project-planning-chart">
              <h4>Cost by Member</h4>
              <p class="project-planning-placeholder">Chart placeholder</p>
            </section>
            <section class="project-planning-block project-planning-chart">
              <h4>Revenue vs Cost</h4>
              <p class="project-planning-placeholder">Chart placeholder</p>
            </section>
            <section class="project-planning-block project-planning-chart">
              <h4>Staffing Mix</h4>
              <p class="project-planning-placeholder">Chart placeholder</p>
            </section>
            <section class="project-planning-block project-planning-chart">
              <h4>Margin Summary</h4>
              <p class="project-planning-placeholder">Chart placeholder</p>
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
    const kpiBudgetNode = container.querySelector('[data-kpi="budget"]');
    const kpiPlannedCostNode = container.querySelector('[data-kpi="plannedCost"]');
    const kpiGrossMarginNode = container.querySelector('[data-kpi="grossMargin"]');
    const kpiMarginPctNode = container.querySelector('[data-kpi="marginPct"]');
    const kpiHoursNode = container.querySelector('[data-kpi="hours"]');
    const consumptionWrap = container.querySelector("[data-consumption-wrap]");
    const consumptionFill = container.querySelector("[data-consumption-fill]");
    const consumptionLabel = container.querySelector("[data-consumption-label]");

    function renderComputed() {
      planningRows = computeRows(planningRows);
      const totals = computeTotals(planningRows, contractAmount, overheadValue);

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

      if (kpiContractNode) kpiContractNode.textContent = fmtMoneyZero(contractAmount);
      if (kpiBudgetNode) kpiBudgetNode.textContent = fmtMoneyZero(budgetAmount);
      if (kpiPlannedCostNode) kpiPlannedCostNode.textContent = fmtMoneyZero(totals.totalCost);
      if (kpiGrossMarginNode) kpiGrossMarginNode.textContent = totals.hasContract ? fmtMoneyZero(totals.grossMargin) : "—";
      if (kpiMarginPctNode) kpiMarginPctNode.textContent = totals.hasContract ? fmtPercent(totals.marginPercent) : "—";
      if (kpiHoursNode) kpiHoursNode.textContent = totals.totalHours.toFixed(2);

      if (consumptionWrap) {
        consumptionWrap.hidden = !totals.hasContract;
      }
      if (totals.hasContract && consumptionFill && consumptionLabel) {
        const rawPct = contractAmount > 0 ? (totals.totalCost / contractAmount) * 100 : 0;
        const safePct = Math.max(0, rawPct);
        consumptionFill.style.width = `${Math.min(safePct, 100).toFixed(2)}%`;
        consumptionLabel.textContent = `${safePct.toFixed(2)}% of contract consumed`;
      }
    }

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
