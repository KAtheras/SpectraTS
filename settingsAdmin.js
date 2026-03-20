(function () {
  const deps = () => window.settingsAdminDeps || {};

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
              ${["staff", "manager", "executive", "admin"]
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
        const lead = item.officeLeadUserId ? usersById.get(item.officeLeadUserId) : null;
        const leadName = lead ? lead.displayName : "No lead";

        const leadOptions = [
          `<option value="">No lead</option>`,
          ...state.users
            .map((u) => `<option value="${escapeHtml(u.id)}"${u.id === item.officeLeadUserId ? " selected" : ""}>${escapeHtml(u.displayName)}</option>`),
        ].join("");

        return `
          <div class="office-row" data-office-id="${escapeHtml(item.id || "")}">
            <div class="office-row-view" data-office-view>
              <div class="office-row-main">
                <div class="office-name">${escapeHtml(item.name)}</div>
                <div class="office-lead">${escapeHtml(leadName)}</div>
              </div>
              <div class="office-actions">
                <button type="button" class="expense-delete" data-office-edit>Edit</button>
                <button type="button" class="expense-delete" data-office-delete>Remove</button>
              </div>
            </div>
            <div class="office-row-edit" data-office-edit-row hidden>
              <input type="text" value="${escapeHtml(item.name)}" data-office-name placeholder="Location name" />
              <select data-office-lead>${leadOptions}</select>
              <div class="office-actions">
                <button type="button" class="expense-toggle is-active" data-office-save>Save</button>
                <button type="button" class="expense-delete" data-office-cancel>Cancel</button>
              </div>
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
      escapeHtml,
    });
  }

  function normalizeModalLevel(level) {
    const { permissionGroupForUser } = deps();
    const group = permissionGroupForUser({ level });
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
    renderExpenseCategories,
    renderOfficeLocations,
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
