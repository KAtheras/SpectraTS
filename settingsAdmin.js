(function () {
  const deps = () => window.settingsAdminDeps || {};
  const SETTINGS_TABS = ["levels", "categories", "locations", "rates", "departments"];
  let activeSettingsTab = "levels";
  let tabsInitialized = false;

  function settingsTabElements() {
    const tabButtons = Array.from(document.querySelectorAll("[data-settings-tab-button]"));
    const panels = Array.from(document.querySelectorAll("[data-settings-tab]"));
    return { tabButtons, panels };
  }

  function allowedTabs() {
    const { state, isGlobalAdmin } = deps();
    const access = state?.settingsAccess;
    if (!access) return [];
    const tabs = [];
    if (access.editPermissionMatrix) tabs.push("levels");
    if (access.manageCategories) tabs.push("categories");
    if (access.manageLocations) tabs.push("locations");
    if (access.viewMemberRates || access.editMemberRates) tabs.push("rates");
    if (isGlobalAdmin?.(state.currentUser)) tabs.push("departments");
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

  function renderSettingsTabs() {
    const { state } = deps();
    if (!state?.settingsAccess) return;
    if (!state.settingsAccess.settingsShell) {
      const settingsPage = document.getElementById("settings-page");
      if (settingsPage) settingsPage.hidden = true;
      return;
    }
    const { tabButtons } = settingsTabElements();
    tabButtons.forEach(function (btn) {
      if (btn.dataset.settingsTabButton === "rates") {
        btn.textContent = "Members";
      }
    });
    const settingsPage = document.getElementById("settings-page");
    if (settingsPage) settingsPage.hidden = false;
    initSettingsTabs();
  }

  function renderDepartments() {
    const { refs, state, escapeHtml } = deps();
    if (!refs.departmentRows) return;

    const departments = Array.isArray(state.departments) ? state.departments.slice() : [];

    refs.departmentRows.innerHTML = departments
      .map(
        (item) => `
          <div class="level-row department-row" data-department-id="${escapeHtml(item.id || "")}">
            <span class="level-num sr-only">Department</span>
            <input type="text" value="${escapeHtml(item.name || "")}" data-department-name placeholder="Department name" />
            <div class="expense-actions">
              <button
                type="button"
                class="expense-toggle ${item.isActive === false ? "is-inactive" : "is-active"}"
                data-department-active
                data-active="${item.isActive === false ? "false" : "true"}"
                aria-pressed="${item.isActive === false ? "false" : "true"}"
              >
                ${item.isActive === false ? "Inactive" : "Active"}
              </button>
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
    const { refs, escapeHtml, isAdmin } = deps();
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

    const editable = isAdmin(deps().state.currentUser);
    refs.levelRows.querySelectorAll("input, select").forEach(function (el) {
      el.disabled = !editable;
    });
    if (refs.addLevel) {
      refs.addLevel.disabled = !editable;
    }
  }

  function renderRatesRows() {
    const { refs, state, escapeHtml, isAdmin, isGlobalAdmin } = deps();
    if (!refs.ratesRows) return;

    const editable = isAdmin(state.currentUser);
    const deptEditable = isGlobalAdmin(state.currentUser);
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
        const leadOptions = [
          `<option value="">No lead</option>`,
          ...state.users.map((u) =>
            `<option value="${escapeHtml(u.id)}"${u.id === item.officeLeadUserId ? " selected" : ""}>${escapeHtml(u.displayName)}</option>`
          ),
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
    const { isAdmin, state, feedback } = deps();
    if (!isAdmin(state.currentUser)) {
      feedback("Only Admins can edit levels.", true);
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
