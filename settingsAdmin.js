(function () {
  const deps = () => window.settingsAdminDeps || {};
  const SETTINGS_TABS = ["levels", "categories", "locations", "rates", "departments", "permissions"];
  let activeSettingsTab = "levels";
  let tabsInitialized = false;

  function settingsTabElements() {
    const tabButtons = Array.from(document.querySelectorAll("[data-settings-tab-button]"));
    const panels = Array.from(document.querySelectorAll("[data-settings-tab]"));
    return { tabButtons, panels };
  }

  function allowedTabs() {
    const { state } = deps();
    const tabs = [];
    if (state.permissions?.manage_levels) tabs.push("levels");
    if (state.permissions?.manage_expense_categories) tabs.push("categories");
    if (state.permissions?.manage_office_locations) tabs.push("locations");
    if (state.permissions?.view_members_page) {
      tabs.push("rates");
    }
    if (state.permissions?.manage_departments) tabs.push("departments");
    if (state.permissions?.manage_settings_access) tabs.push("permissions");
    return tabs;
  }

  function setActiveSettingsTab(nextTab) {
    const allowed = allowedTabs();
    if (!allowed.length) {
      return;
    }
    const allowedSet = new Set(allowed);

    // Remove disallowed tabs entirely so they do not render.
    let { tabButtons, panels } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      const tabKey = btn.dataset.settingsTabButton;
      if (!allowedSet.has(tabKey) && btn.parentNode) {
        btn.parentNode.removeChild(btn);
      }
    });
    panels.forEach(function (panel) {
      const tabKey = panel.dataset.settingsTab;
      if (!allowedSet.has(tabKey) && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    });

    if (!allowed.length) {
      activeSettingsTab = null;
      return;
    }

    if (!allowedSet.has(nextTab)) {
      nextTab = allowed[0];
    }
    activeSettingsTab = nextTab;

    // Re-read elements after removals
    ({ tabButtons, panels } = settingsTabElements());

    tabButtons.forEach(function (btn) {
      const tabKey = btn.dataset.settingsTabButton;
      const permitted = allowedSet.has(tabKey);
      const isActive = permitted && tabKey === nextTab;
      btn.hidden = !permitted;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    panels.forEach(function (panel) {
      const tabKey = panel.dataset.settingsTab;
      const permitted = allowedSet.has(tabKey);
      const isActive = permitted && tabKey === nextTab;
      panel.hidden = !isActive;
    });
  }

  function initSettingsTabs() {
    if (tabsInitialized) {
      setActiveSettingsTab(activeSettingsTab);
      return;
    }
    tabsInitialized = true;
    const { tabButtons } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        const targetTab = btn.dataset.settingsTabButton;
        setActiveSettingsTab(targetTab);
      });
    });
    setActiveSettingsTab(activeSettingsTab);
  }

  function arrangeSettingsSectionHeaders() {
    const settingsPage = document.getElementById("settings-page");
    if (!settingsPage) return;
    const sectionPanels = Array.from(
      settingsPage.querySelectorAll(
        '[data-settings-tab="levels"], [data-settings-tab="categories"], [data-settings-tab="locations"], [data-settings-tab="rates"], [data-settings-tab="departments"]'
      )
    );

    sectionPanels.forEach((panel) => {
      const inner = panel.querySelector(".level-labels-inner");
      if (!inner) return;
      const title = inner.querySelector("h3");
      if (!title) return;

      let header = inner.querySelector(".settings-section-header");
      if (!header) {
        header = document.createElement("div");
        header.className = "settings-section-header";
        inner.insertBefore(header, inner.firstChild);
      }

      let left = header.querySelector(".settings-section-left");
      if (!left) {
        left = document.createElement("div");
        left.className = "settings-section-left";
        header.appendChild(left);
      }

      let right = header.querySelector(".settings-section-right");
      if (!right) {
        right = document.createElement("div");
        right.className = "settings-section-right";
        header.appendChild(right);
      }

      if (title.parentElement !== left) {
        left.appendChild(title);
      }

      const actions = inner.querySelector(".level-labels-actions");
      if (actions) {
        const buttons = Array.from(actions.querySelectorAll("button"));
        buttons.forEach((btn) => {
          const isAdd =
            btn.id.startsWith("add-") ||
            btn.classList.contains("button-ghost");
          if (isAdd) {
            if (btn.parentElement !== left) left.appendChild(btn);
          } else if (btn.type === "submit" || btn.id.startsWith("save-")) {
            if (btn.parentElement !== right) right.appendChild(btn);
          }
        });
        if (!actions.querySelector("button")) {
          actions.remove();
        }
      }
    });
  }

  function renderSettingsTabs() {
    const { state } = deps();
    if (!state?.permissions) return;
    if (!state.permissions.view_settings_tab) {
      const settingsPage = document.getElementById("settings-page");
      if (settingsPage) settingsPage.hidden = true;
      return;
    }
    const labelByTab = {
      levels: "Member levels",
      categories: "Expense categories",
      locations: "Office locations",
      rates: "Member information",
      departments: "Practice departments",
      permissions: "Member access levels",
    };
    const { tabButtons } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      const key = btn.dataset.settingsTabButton;
      if (labelByTab[key]) {
        btn.textContent = labelByTab[key];
      }
    });
    const settingsPage = document.getElementById("settings-page");
    if (settingsPage) settingsPage.hidden = false;
    const settingsBody = document.querySelector("#settings-page .users-page-body");
    if (settingsBody) {
      let panelsContainer = settingsBody.querySelector(".settings-panels");
      if (!panelsContainer) {
        panelsContainer = document.createElement("div");
        panelsContainer.className = "settings-panels";
        const existingPanels = Array.from(settingsBody.querySelectorAll("[data-settings-tab]"));
        if (existingPanels.length) {
          const anchor = existingPanels[0];
          settingsBody.insertBefore(panelsContainer, anchor);
          existingPanels.forEach((panel) => panelsContainer.appendChild(panel));
        } else {
          settingsBody.appendChild(panelsContainer);
        }
      }

      let layout = settingsBody.querySelector(".settings-layout");
      const tabsContainer = settingsBody.querySelector(".settings-tabs");
      if (tabsContainer && panelsContainer) {
        if (!layout) {
          layout = document.createElement("div");
          layout.className = "settings-layout";
          settingsBody.insertBefore(layout, tabsContainer);
        }
        let navShell = layout.querySelector(".settings-nav-shell");
        if (!navShell) {
          navShell = document.createElement("div");
          navShell.className = "settings-nav-shell";
          layout.appendChild(navShell);
        }
        let contentShell = layout.querySelector(".settings-content-shell");
        if (!contentShell) {
          contentShell = document.createElement("div");
          contentShell.className = "settings-content-shell";
          layout.appendChild(contentShell);
        }
        if (tabsContainer.parentElement !== navShell) {
          navShell.appendChild(tabsContainer);
        }
        if (panelsContainer.parentElement !== contentShell) {
          contentShell.appendChild(panelsContainer);
        }
      }

      if (!document.getElementById("settings-layout-style")) {
        const style = document.createElement("style");
        style.id = "settings-layout-style";
        style.textContent = `
          #settings-page .settings-layout{display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:22px;align-items:stretch}
          #settings-page .settings-nav-shell,
          #settings-page .settings-content-shell{
            border:1px solid var(--panel-border);
            border-radius:var(--card-radius);
            background:var(--panel);
            box-shadow:var(--shadow);
            padding:14px;
            height:clamp(500px, calc(100vh - 170px), 80vh);
            overflow:auto;
          }
          #settings-page .settings-tabs{display:flex;flex-direction:column;gap:12px}
          #settings-page .settings-tab{
            display:block;
            width:100%;
            text-align:left;
            border-radius:var(--card-radius);
            padding:14px 16px;
            border:1px solid var(--panel-border);
            background:var(--panel);
            color:var(--text);
            font-weight:700;
            transition:border-color .16s ease,box-shadow .16s ease,background .16s ease,transform .12s ease;
          }
          #settings-page .settings-tab:hover{
            border-color:color-mix(in srgb, var(--panel-border) 55%, var(--group-border) 45%);
            background:var(--surface-hover);
            box-shadow:none;
            transform:none;
          }
          #settings-page .settings-tab.is-active{
            border-color:var(--group-border);
            background:var(--surface-strong);
            box-shadow:0 0 0 1px color-mix(in srgb, var(--group-border) 40%, transparent);
          }
          #settings-page .settings-panels{min-width:0}
          #settings-page .settings-panels [data-settings-tab]{width:100%}
          #settings-page .settings-panels .level-labels-inner{max-width:none}
          #settings-page .settings-section-header{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            padding-bottom:12px;
            margin-bottom:12px;
            border-bottom:1px solid var(--group-border);
          }
          #settings-page .settings-section-left{
            display:flex;
            align-items:center;
            gap:10px;
            flex-wrap:wrap;
            min-width:0;
          }
          #settings-page .settings-section-left h3{
            margin:0;
          }
          #settings-page .settings-section-right{
            display:flex;
            align-items:center;
            gap:10px;
            margin-left:auto;
          }
          #settings-page .settings-section-right .button,
          #settings-page .settings-section-left .button{
            margin:0;
          }
          @media (max-width: 980px){
            #settings-page .settings-layout{grid-template-columns:1fr;gap:14px}
            #settings-page .settings-nav-shell,
            #settings-page .settings-content-shell{
              height:auto;
              max-height:none;
              overflow:visible;
              padding:12px;
            }
          }
        `;
        document.head.appendChild(style);
      }
    }

    // Ensure permissions tab exists for superusers
    const canManageSettingsAccess = state.permissions?.manage_settings_access;
    if (canManageSettingsAccess) {
      const tabsContainer = document.querySelector("#settings-page .settings-tabs");
      const panelsContainer = document.querySelector("#settings-page .settings-panels") || settingsPage;
      if (tabsContainer && panelsContainer) {
        let permBtn = tabsContainer.querySelector('[data-settings-tab-button="permissions"]');
        if (!permBtn) {
          permBtn = document.createElement("button");
          permBtn.className = "settings-tab";
          permBtn.type = "button";
          permBtn.dataset.settingsTabButton = "permissions";
          permBtn.textContent = "Member access levels";
          tabsContainer.appendChild(permBtn);
          permBtn.addEventListener("click", function (event) {
            event.preventDefault();
            setActiveSettingsTab("permissions");
          });
        }
        let permPanel = panelsContainer.querySelector('[data-settings-tab="permissions"]');
        if (!permPanel) {
          permPanel = document.createElement("div");
          permPanel.dataset.settingsTab = "permissions";
          permPanel.className = "settings-panel";
          panelsContainer.appendChild(permPanel);
        }
      }
    }
    arrangeSettingsSectionHeaders();
    initSettingsTabs();
    renderPermissionsMatrix();
  }

  function renderPermissionsMatrix() {
    const { state, escapeHtml } = deps();
    const panel = document.querySelector('[data-settings-tab="permissions"]');
    if (!panel) return;
    const roles = Array.isArray(state.permissionRoles) ? state.permissionRoles : [];
    const rolePerms = Array.isArray(state.rolePermissions) ? state.rolePermissions : [];
    const caps = [
      "view_settings_shell",
      "view_members",
      "view_member_rates",
      "edit_member_rates",
      "edit_member_profile",
      "manage_departments",
      "manage_levels",
      "manage_expense_categories",
      "manage_office_locations",
      "manage_settings_access",
    ];

    const allowedSet = new Set(
      rolePerms
        .filter((p) => p.allowed && p.scope_key === "own_office")
        .map((p) => `${p.role_key}|${p.capability_key}`)
    );

    const rowsHtml = caps
      .map((cap) => {
        const cells = roles
          .map((role) => {
            const checked = allowedSet.has(`${role.key}|${cap}`);
            const isSuperuserRole = role.key === "superuser";
            const lockedAttrs = isSuperuserRole
              ? `disabled aria-disabled="true" class="locked-perm" title="Superuser permissions are fixed" data-perm-locked="true" data-locked-value="${checked ? "true" : "false"}"`
              : "";
            return `<td><input type="checkbox" data-perm-role="${escapeHtml(role.key)}" data-perm-cap="${escapeHtml(cap)}" ${checked ? "checked" : ""} ${lockedAttrs}></td>`;
          })
          .join("");
        return `<tr><th scope="row">${escapeHtml(cap)}</th>${cells}</tr>`;
      })
      .join("");

    panel.innerHTML = `
      <div class="settings-section-header">
        <div class="settings-section-left">
          <h3>Member access levels</h3>
        </div>
        <div class="settings-section-right">
          <button type="button" id="permissions-save" class="button">Save Access</button>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="table perms-matrix">
          <thead>
            <tr>
              <th scope="col">Capability</th>
              ${roles.map((r) => `<th scope="col">${escapeHtml(r.label || r.key)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    const saveBtn = document.getElementById("permissions-save");
    panel.addEventListener("click", function (event) {
      const input = event.target.closest('[data-perm-locked="true"]');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      input.checked = input.dataset.lockedValue === "true";
    });
    panel.addEventListener("keydown", function (event) {
      const input = event.target.closest('[data-perm-locked="true"]');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
    });
    panel.addEventListener("change", function (event) {
      const input = event.target.closest('[data-perm-locked="true"]');
      if (!input) return;
      input.checked = input.dataset.lockedValue === "true";
    });
    if (saveBtn) {
      saveBtn.addEventListener("click", async function () {
        const inputs = Array.from(panel.querySelectorAll("[data-perm-role][data-perm-cap]"));
        const next = [];
        inputs.forEach((input) => {
          const roleKey = input.dataset.permRole;
          if (roleKey === "superuser" || input.dataset.permLocked === "true") {
            return;
          }
          const capKey = input.dataset.permCap;
          const allowed = input.checked;
          next.push({ role: roleKey, capability: capKey, allowed });
        });
        try {
          await deps().mutatePersistentState(
            "update_role_permissions",
            { rolePermissions: next },
            { skipHydrate: true }
          );
          await deps().loadPersistentState();
          renderSettingsTabs();
          renderPermissionsMatrix();
          deps().feedback("Access updated.", false);
        } catch (error) {
          deps().feedback(error.message || "Unable to save access.", true);
        }
      });
    }
  }

  function renderDepartments() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.departmentRows) return;

    const departments = Array.isArray(state.departments) ? state.departments.slice() : [];
    const editable = Boolean(state.permissions?.manage_departments);

    refs.departmentRows.innerHTML = departments
      .map(
        (item) => `
          <div class="level-row department-row" data-department-id="${escapeHtml(item.id || "")}">
            <span class="level-num sr-only">Department</span>
            <input type="text" value="${escapeHtml(item.name || "")}" data-department-name placeholder="Department name" ${editable ? "" : "disabled"} />
            <div class="expense-actions">
              <button
                type="button"
                class="expense-toggle ${item.isActive === false ? "is-inactive" : "is-active"}"
                data-department-active
                data-active="${item.isActive === false ? "false" : "true"}"
                aria-pressed="${item.isActive === false ? "false" : "true"}"
                ${editable ? "" : "disabled"}
              >
                ${item.isActive === false ? "Inactive" : "Active"}
              </button>
              ${editable ? `<button type="button" class="expense-delete" data-department-delete>Delete</button>` : ""}
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderUsersList() {
    const {
      usersRenderUsersList,
      refs,
      state,
      levelLabel,
      isAdmin,
      isGlobalAdmin,
      isManager,
      managerClientAssignments,
      managerProjectAssignments,
      projectMembersForUser,
      escapeHtml,
      disabledButtonAttrs,
    } = deps();
    usersRenderUsersList?.({
      refs,
      state,
      levelLabel,
      levels: sortedLevels(),
      isAdmin,
      isGlobalAdmin,
      isManager,
      managerClientAssignments,
      managerProjectAssignments,
      projectMembersForUser,
      escapeHtml,
      disabledButtonAttrs,
    });
  }

  function renderLevelRows() {
    const { refs, escapeHtml, state } = deps();
    if (!refs.levelRows) return;

    const sorted = getLevelDefinitions().slice().sort((a, b) => a.level - b.level);

    refs.levelRows.innerHTML = sorted
      .map(
        (item) => `
          <div class="level-row" data-level="${item.level}">
            <span class="level-num">Level ${item.level}</span>
            <input type="text" value="${escapeHtml(item.label || "")}" data-level-label />
            <select data-level-permission>
              ${["staff", "manager", "executive", "admin", "superuser"]
                .map(
                  (group) =>
                    `<option value="${group}"${group === item.permissionGroup ? " selected" : ""}>${group}</option>`
                )
                .join("")}
            </select>
            <button type="button" class="level-delete" data-level-delete aria-label="Delete level">Delete</button>
          </div>
        `
      )
      .join("");

    const editable = Boolean(state.permissions?.manage_levels);
    refs.levelRows.querySelectorAll("input, select").forEach(function (el) {
      el.disabled = !editable;
    });
    if (refs.addLevel) {
      refs.addLevel.disabled = !editable;
    }
  }

  function renderRatesRows() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.ratesRows) return;

    const editable = Boolean(state.permissions?.edit_user_rates);
    const deptEditable = Boolean(state.permissions?.edit_user_profile);
    const users = (state.users || []).filter((u) => u.isActive !== false);
    const departments = (state.departments || []).filter((d) => d.isActive !== false);

    const departmentOptions = (selected) =>
      [`<option value="">No department</option>`]
        .concat(
          departments.map(
            (d) => `<option value="${escapeHtml(d.id)}"${selected === d.id ? " selected" : ""}>${escapeHtml(d.name)}</option>`
          )
        )
        .join("");

    refs.ratesRows.innerHTML = users
      .map(
        (user) => `
          <div class="level-row rate-row" data-user-id="${escapeHtml(user.id)}">
            <span class="level-num">${escapeHtml(user.displayName)}</span>
            <input type="number" step="0.01" min="0" data-rate-base value="${user.baseRate ?? ""}" ${editable ? "" : "disabled"} style="width:140px" />
            <input type="number" step="0.01" min="0" data-rate-cost value="${user.costRate ?? ""}" ${editable ? "" : "disabled"} style="width:140px" />
            <select data-department-select="${escapeHtml(user.id)}" ${deptEditable ? "" : "disabled"} style="width:160px">
              ${departmentOptions(user.departmentId || "")}
            </select>
          </div>
        `
      )
      .join("");
  }

  function renderExpenseCategories() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.expenseRows) return;

    const categories = state.expenseCategories.length ? [...state.expenseCategories] : [];

    refs.expenseRows.innerHTML = categories
      .map(
        (item) => `
          <div class="level-row expense-row" data-expense-id="${escapeHtml(item.id || "")}">
            <span class="level-num sr-only">Category</span>
            <input type="text" value="${escapeHtml(item.name || "")}" data-expense-name placeholder="Category name" />
            <div class="expense-actions">
              <button
                type="button"
                class="expense-toggle ${item.isActive === false ? "is-inactive" : "is-active"}"
                data-expense-active
                data-active="${item.isActive === false ? "false" : "true"}"
                aria-pressed="${item.isActive === false ? "false" : "true"}"
              >
                ${item.isActive === false ? "Inactive" : "Active"}
              </button>
              <button type="button" class="expense-delete" data-expense-delete>Delete</button>
            </div>
          </div>
        `
      )
      .join("");
  }

  function renderOfficeLocations() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.officeRows) return;

    const usersById = new Map((state.users || []).map((u) => [u.id, u]));

    refs.officeRows.innerHTML = (state.officeLocations || [])
      .map(function (item) {
        const leadUserId = item.officeLeadUserId || "";
        const leadUser =
          usersById.get(leadUserId) ||
          (leadUserId && item.officeLeadUserName
            ? { id: leadUserId, displayName: item.officeLeadUserName }
            : null);
        const leadOptions = [
          `<option value="">No lead</option>`,
          ...state.users.map((u) =>
            `<option value="${escapeHtml(u.id)}"${u.id === leadUserId ? " selected" : ""}>${escapeHtml(u.displayName)}</option>`
          ),
          ...(leadUser && !usersById.has(leadUserId)
            ? [
                `<option value="${escapeHtml(leadUser.id)}" selected>${escapeHtml(
                  leadUser.displayName
                )}</option>`,
              ]
            : []),
        ].join("");

        return `
          <div class="level-row office-row" data-office-id="${escapeHtml(item.id || "")}">
            <input type="text" value="${escapeHtml(item.name)}" data-office-name placeholder="Location name" />
            <select data-office-lead>${leadOptions}</select>
            <div class="office-actions">
              <button type="button" class="expense-delete" data-office-delete>Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    if (refs.officeAddLead) {
      const options = [
        `<option value="">Office Lead (optional)</option>`,
        ...state.users.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.displayName)}</option>`),
      ];
      refs.officeAddLead.innerHTML = options.join("");
    }
  }

  function sortedLevels() {
    const { permissionGroupForUser, state, DEFAULT_LEVEL_DEFS } = deps();
    const rank = (level) => {
      const group = permissionGroupForUser({ level }) || "staff";
      if (group === "staff") return 0;
      if (group === "manager") return 1;
      if (group === "executive") return 2;
      return 3; // admin or anything higher
    };
    const fromState = Object.keys(state.levelLabels || {}).map((l) => Number(l));
    const levels = fromState.length ? fromState : Object.keys(DEFAULT_LEVEL_DEFS).map((l) => Number(l));
    return Array.from(new Set(levels))
      .filter((l) => Number.isFinite(l))
      .sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        return rankDiff !== 0 ? rankDiff : a - b;
      });
  }

  function getLevelDefinitions() {
    const { state, DEFAULT_LEVEL_DEFS } = deps();
    const levels = sortedLevels();
    return levels.map(function (lvl) {
      const value = state.levelLabels?.[lvl];
      const label =
        value && typeof value === "object"
          ? value.label
          : typeof value === "string"
            ? value
            : DEFAULT_LEVEL_DEFS[lvl]?.label || `Level ${lvl}`;
      const permissionGroup =
        value && typeof value === "object"
          ? value.permissionGroup || value.permission_group
          : DEFAULT_LEVEL_DEFS[lvl]?.permissionGroup || "staff";
      return { level: lvl, label, permissionGroup };
    });
  }

  function syncUserManagementControls() {
    const {
      usersSyncUserManagementControls,
      refs,
      state,
      isAdmin,
      isGlobalAdmin,
      levelLabel,
      escapeHtml,
      field,
    } = deps();
    usersSyncUserManagementControls?.({
      refs,
      state,
      isAdmin,
      isGlobalAdmin,
      levelLabel,
      levels: sortedLevels(),
      escapeHtml,
      field,
    });
  }

  function handleAddLevel() {
    const { state, feedback } = deps();
    if (!state.permissions?.manage_levels) {
      feedback("Access denied.", true);
      return;
    }
    const currentLevels = sortedLevels();
    const maxLevel = currentLevels.length ? Math.max(...currentLevels) : 6;
    const nextLevel = maxLevel + 1;
    state.levelLabels = {
      ...state.levelLabels,
      [nextLevel]: {
        label: `Level ${nextLevel}`,
        permissionGroup: "staff",
      },
    };
    renderLevelRows();
  }

  function setMembersFeedback(message, isError) {
    const { refs } = deps();
    if (!refs.membersFeedback) {
      return;
    }
    refs.membersFeedback.textContent = message || "";
    refs.membersFeedback.dataset.error = isError ? "true" : "false";
  }

  function renderMembersModal() {
    const {
      membersRenderMembersModal,
      refs,
      state,
      memberModalState,
      isGlobalAdmin,
      isStaff,
      isManager,
      levelLabel,
      getUserById,
      directManagerIdsForProject,
      isUserAssignedToProject,
      managerIdsForProject,
      staffIdsForProject,
      managerIdsForClientScope,
      staffIdsForClient,
      escapeHtml,
      roleKey,
    } = deps();
    membersRenderMembersModal?.({
      refs,
      state,
      memberModalState,
      levels: sortedLevels(),
      isGlobalAdmin,
      isStaff,
      isManager,
      levelLabel,
      normalizeLevel: normalizeModalLevel,
      getUserById,
      directManagerIdsForProject,
      isUserAssignedToProject,
      managerIdsForProject,
      staffIdsForProject,
      managerIdsForClientScope,
      staffIdsForClient,
      roleKey,
      escapeHtml,
    });
  }

  function normalizeModalLevel(level) {
    const { permissionGroupForUser } = deps();
    const group = permissionGroupForUser({ level });
    if (group === "superuser") return 6;
    if (group === "admin") return 5;
    if (group === "executive") return 4;
    if (group === "manager") return 3;
    return 1; // staff
  }

  function openChangePasswordModal() {
    const { refs } = deps();
    if (!refs.changePasswordModal) return;
    refs.changePasswordModal.hidden = false;
    refs.changePasswordCurrent.value = "";
    refs.changePasswordNew.value = "";
    refs.changePasswordConfirm.value = "";
    refs.changePasswordCurrent.focus();
  }

  function closeChangePasswordModal() {
    const { refs } = deps();
    if (!refs.changePasswordModal) return;
    refs.changePasswordModal.hidden = true;
  }

  window.settingsAdmin = {
    renderUsersList,
    renderLevelRows,
    renderRatesRows,
    renderExpenseCategories,
    renderOfficeLocations,
    renderDepartments,
    renderSettingsTabs,
    sortedLevels,
    getLevelDefinitions,
    syncUserManagementControls,
    handleAddLevel,
    setMembersFeedback,
    renderMembersModal,
    normalizeModalLevel,
    openChangePasswordModal,
    closeChangePasswordModal,
  };
})();
