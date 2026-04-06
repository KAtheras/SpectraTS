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
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
  }

  function fmtPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${num}%`;
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
    const projectMembers = Array.isArray(state?.assignments?.projectMembers)
      ? state.assignments.projectMembers.filter(
          (row) => String(row?.projectId || "").trim() === String(project?.id || "").trim()
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
    const overheadValue = project?.overheadPercent ?? project?.overhead_percent ?? null;
    const kpiCards = [
      ["Contract Amount", fmtMoney(project?.contractAmount ?? project?.contract_amount)],
      ["Budget", fmtMoney(project?.budget)],
      ["Planned Cost", "—"],
      ["Gross Margin", "—"],
      ["Margin %", "—"],
      ["Planned Hours", "—"],
    ];

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
                <span class="project-planning-field-value">${escapeHtml(fmtMoney(project?.contractAmount ?? project?.contract_amount))}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Budget</span>
                <span class="project-planning-field-value">${escapeHtml(fmtMoney(project?.budget))}</span>
              </div>
              <div class="project-planning-field">
                <span class="project-planning-field-label">Overhead %</span>
                <span class="project-planning-field-value">${escapeHtml(fmtPercent(overheadValue))}</span>
              </div>
            </section>
          </aside>
          <main>
            <section class="project-planning-kpis">
              ${kpiCards
                .map(
                  ([label, value]) => `
                <article class="project-planning-kpi">
                  <div class="project-planning-kpi-label">${escapeHtml(label)}</div>
                  <div class="project-planning-kpi-value">${escapeHtml(value)}</div>
                </article>
              `
                )
                .join("")}
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
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      projectMembers.length
                        ? projectMembers
                            .slice(0, 8)
                            .map((row) => {
                              const member = usersById.get(String(row?.userId || "").trim());
                              const memberName = member?.displayName || "Unassigned";
                              const role = member?.permissionGroup || member?.permission_group || "—";
                              const costRate = Number(member?.costRate ?? member?.cost_rate);
                              const chargeRate = Number(row?.chargeRateOverride ?? row?.charge_rate_override);
                              return `
                                <tr>
                                  <td>${escapeHtml(memberName)}</td>
                                  <td>${escapeHtml(String(role).replace(/_/g, " "))}</td>
                                  <td>${escapeHtml(Number.isFinite(costRate) ? fmtMoney(costRate) : "—")}</td>
                                  <td>${escapeHtml(Number.isFinite(chargeRate) ? fmtMoney(chargeRate) : "—")}</td>
                                  <td>—</td>
                                  <td>—</td>
                                  <td>—</td>
                                  <td>—</td>
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
    container.querySelector("[data-project-planning-save]")?.addEventListener("click", () => {
      if (typeof onSave === "function") onSave();
    });
  }

  window.projectPlanning = {
    renderProjectPlanningPage,
  };
})();

