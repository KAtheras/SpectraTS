(function () {
  let selectedUserId = null;
  let detailEditUserId = null;
  let detailEditMode = false;
  let detailDraft = {};
  let memberSearchTerm = "";
  let memberLevelFilter = "";

  function setUserFeedback(deps, message, isError) {
    const { refs } = deps;
    if (!refs.userFeedback) {
      return;
    }

    refs.userFeedback.textContent = message || "";
    refs.userFeedback.dataset.error = isError ? "true" : "false";
  }

  function openUsersModal(deps) {
    const { refs, body, postHeight } = deps;
    setUserFeedback(deps, "", false);
    refs.usersModal.hidden = false;
    refs.usersModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    postHeight();
  }

  function closeUsersModal(deps) {
    const { refs, body, postHeight } = deps;
    refs.usersModal.hidden = true;
    refs.usersModal.setAttribute("aria-hidden", "true");
    if (refs.catalogModal.hidden && (!refs.membersModal || refs.membersModal.hidden)) {
      body.classList.remove("modal-open");
    }
    postHeight();
  }

  function setDetailEditState(userId, editing, draft) {
    detailEditUserId = editing ? userId : null;
    detailEditMode = Boolean(editing);
    detailDraft = draft || {};
  }

  function renderUsersList(deps) {
    const {
      refs,
      state,
      levelLabel,
      levels,
      isAdmin,
      isGlobalAdmin,
      isManager,
      managerClientAssignments,
      managerProjectAssignments,
      projectMembersForUser,
      escapeHtml,
      disabledButtonAttrs,
    } = deps;

    if (!refs.userList) {
      return;
    }

    if (!state.users.length) {
      refs.userList.innerHTML = '<p class="empty-state">No team members yet.</p>';
      return;
    }

    if (!selectedUserId || !state.users.some((u) => u.id === selectedUserId)) {
      selectedUserId = state.users[0].id;
      detailEditMode = false;
      detailEditUserId = null;
      detailDraft = {};
    }

    const selectedUser = state.users.find((u) => u.id === selectedUserId) || state.users[0];
    if (detailEditUserId && detailEditUserId !== selectedUser.id) {
      detailEditMode = false;
      detailEditUserId = null;
      detailDraft = {};
    }

    const previousScroll =
      refs.userList.querySelector(".member-card-list")?.scrollTop ??
      refs.userList.querySelector(".user-list-column")?.scrollTop ??
      0;
    const wasSearchFocused =
      document.activeElement &&
      document.activeElement.classList &&
      document.activeElement.classList.contains("member-card-search");

    const searchValue = (memberSearchTerm || "").trim().toLowerCase();
    const filteredUsers = state.users.filter(function (user) {
      if (memberLevelFilter && String(user.level) !== memberLevelFilter) {
        return false;
      }
      if (!searchValue) return true;
      const name = (user.displayName || "").toLowerCase();
      const username = (user.username || "").toLowerCase();
      return name.includes(searchValue) || username.includes(searchValue);
    });

    const levelGroups = new Map();

    filteredUsers.forEach(function (user) {
      const levelKey = String(user.level);
      if (!levelGroups.has(levelKey)) {
        levelGroups.set(levelKey, {
          label: levelLabel(user.level),
          users: [],
        });
      }
      levelGroups.get(levelKey).users.push(user);
    });

    const configuredOrder = Array.isArray(levels)
      ? Array.from(new Set(levels))
          .sort(function (a, b) { return a - b; })
          .map(function (lvl) { return String(lvl); })
      : [];

    const extraLevels = Array.from(levelGroups.keys()).filter(function (lvl) {
      return configuredOrder.indexOf(lvl) === -1;
    });

    const levelOrder = configuredOrder.concat(extraLevels);

    const listHtml = levelOrder
      .map(function (levelKey) {
        const group = levelGroups.get(levelKey);
        if (!group) return "";

        const itemsHtml = group.users
          .map(function (user) {
            const roleLabelText = levelLabel(user.level);
            const isCurrentUser = state.currentUser?.id === user.id;
            const canManageUsers = isAdmin(state.currentUser);
            const isSelected = selectedUserId === user.id;

            const currentDot = isCurrentUser
              ? '<span class="user-current-dot" aria-label="Current session"></span>'
              : "";

            return `
              <article class="catalog-item user-item ${isSelected ? "is-selected" : ""}" data-user-id="${escapeHtml(user.id)}">
                <div class="user-item-row">
                  <span class="catalog-item-title">
                    ${currentDot}<span>${escapeHtml(user.displayName)}</span>
                  </span>
                  <span class="user-item-meta">
                    <span>${escapeHtml(roleLabelText)}</span>
                  </span>
                </div>
              </article>
            `;
          })
          .join("");

        return `
          <div class="member-level-group">
            <div class="member-level-heading">${escapeHtml(group.label)}</div>
            ${itemsHtml}
          </div>
        `;
      })
      .join("");

    const levelFilterOptions = Array.isArray(levels)
      ? Array.from(new Set(levels))
          .sort(function (a, b) { return a - b; })
          .map(function (level) {
            return `<option value="${escapeHtml(String(level))}" ${memberLevelFilter === String(level) ? "selected" : ""}>${escapeHtml(levelLabel(level))}</option>`;
          })
          .join("")
      : "";

    function assignmentSummary(user) {
      const clients =
        isManager(user) || isAdmin(user)
          ? managerClientAssignments(user.id).map((item) => item.client)
          : [];
      const managerProjects =
        isManager(user) || isAdmin(user)
          ? managerProjectAssignments(user.id).map((item) => ({ client: item.client, project: item.project }))
          : [];
      const memberProjects = projectMembersForUser(user.id).map((item) => ({
        client: item.client,
        project: item.project,
      }));
      return {
        clients: [...new Set(clients)].sort(),
        projects: [...new Map([...managerProjects, ...memberProjects].map((p) => [p.client + "::" + p.project, p])).values()],
      };
    }

    const assignments = assignmentSummary(selectedUser);
    const editing = detailEditMode && detailEditUserId === selectedUser.id;
    const canManageUsers = isAdmin(state.currentUser);
    const canChangeRole = isGlobalAdmin(state.currentUser);
    const canResetPassword = canManageUsers;
    const canDeactivate = canManageUsers && state.currentUser?.id !== selectedUser.id;
    const disabledReason = "Admin only.";
    const changeLevelReason = "Level 6 only.";
    const levelChoices =
      Array.isArray(levels) && levels.length
        ? Array.from(new Set(levels)).sort((a, b) => a - b)
        : [];
    const selectedValue = editing ? detailDraft.level ?? selectedUser.level : selectedUser.level;
    const levelOptions = levelChoices
      .map((level) => `<option value="${level}"${selectedValue === level ? " selected" : ""}>${escapeHtml(levelLabel(level))}</option>`)
      .join("");
    const draftUsername = editing
      ? detailDraft.username ?? selectedUser.username
      : selectedUser.username;
    const draftDisplayName = editing
      ? detailDraft.displayName ?? selectedUser.displayName
      : selectedUser.displayName;
    const draftBase = editing
      ? detailDraft.baseRate ?? selectedUser.baseRate ?? ""
      : selectedUser.baseRate;
    const draftCost = editing
      ? detailDraft.costRate ?? selectedUser.costRate ?? ""
      : selectedUser.costRate;
    const detailHtml = `
      <div class="user-detail-card ${editing ? "is-editing" : ""}">
        <h4>
          ${
            editing
              ? `<input type="text" data-user-field="displayName" value="${escapeHtml(draftDisplayName || "")}" />`
              : escapeHtml(selectedUser.displayName)
          }
        </h4>
        <div class="detail-top-divider"></div>
        <dl>
          <div>
            <dt>Username</dt>
            <dd>
              ${
                editing
                  ? `<input type="text" data-user-field="username" value="${escapeHtml(draftUsername || "")}" />`
                  : escapeHtml(selectedUser.username)
              }
            </dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>
              ${
                editing
                  ? `<select data-user-field="level" ${disabledButtonAttrs(canChangeRole, changeLevelReason)}>${levelOptions}</select>`
                  : escapeHtml(levelLabel(selectedUser.level))
              }
            </dd>
          </div>
          <div>
            <dt>Base Rate</dt>
            <dd>
              ${
                editing
                  ? `<input type="number" step="0.01" min="0" data-user-field="baseRate" value="${draftBase === null || draftBase === undefined ? "" : escapeHtml(String(draftBase))}" />`
                  : selectedUser.baseRate !== null && selectedUser.baseRate !== undefined
                    ? `$${Number(selectedUser.baseRate).toFixed(2)}`
                    : "—"
              }
            </dd>
          </div>
          <div>
            <dt>Cost Rate</dt>
            <dd>
              ${
                editing
                  ? `<input type="number" step="0.01" min="0" data-user-field="costRate" value="${draftCost === null || draftCost === undefined ? "" : escapeHtml(String(draftCost))}" />`
                  : selectedUser.costRate !== null && selectedUser.costRate !== undefined
                    ? `$${Number(selectedUser.costRate).toFixed(2)}`
                    : "—"
              }
            </dd>
          </div>
          <div class="detail-divider"></div>
          <div><dt>Clients/Projects</dt><dd>${assignments.projects.length ? assignments.projects.map((p) => `${escapeHtml(p.client)} / ${escapeHtml(p.project)}`).join("<br>") : "None assigned"}</dd></div>
        </dl>
        <div class="user-detail-actions">
          ${
            editing
              ? `<button type="button" class="button" data-user-panel-save="${escapeHtml(selectedUser.id)}">Save</button>
                 <button type="button" class="button button-ghost" data-user-panel-cancel>Cancel</button>`
              : `<button type="button" class="button" data-user-panel-edit="${escapeHtml(selectedUser.id)}">Edit</button>`
          }
        </div>
        <div class="user-detail-secondary">
          <button
            type="button"
            class="catalog-edit"
            data-user-password="${escapeHtml(selectedUser.id)}"
            ${disabledButtonAttrs(canResetPassword, disabledReason)}
          >
            Reset password
          </button>
          ${
            canDeactivate
              ? `<button
                   type="button"
                   class="catalog-delete"
                   data-user-deactivate="${escapeHtml(selectedUser.id)}"
                   ${disabledButtonAttrs(canDeactivate, disabledReason)}
                 >
                   Deactivate
                 </button>`
              : ""
          }
        </div>
      </div>
    `;

    refs.userList.innerHTML = `
      <div class="user-pane">
        <div class="user-list-column">
          <div class="member-card">
            <div class="member-card-head">
              <input
                type="search"
                class="member-card-search"
                placeholder="Search members"
                aria-label="Search members"
                value="${escapeHtml(memberSearchTerm)}"
              />
              <label class="member-card-filter">
                <span class="sr-only">Level</span>
                <select aria-label="Filter by level">
                  <option value="">All</option>
                  ${levelFilterOptions}
                </select>
              </label>
            </div>
            <div class="catalog-list member-card-list">${listHtml}</div>
          </div>
        </div>
        <div class="user-detail-column">${detailHtml}</div>
      </div>
    `;

    const searchInput = refs.userList.querySelector(".member-card-search");
    const levelSelect = refs.userList.querySelector(".member-card-filter select");

    if (searchInput) {
      searchInput.value = memberSearchTerm;
      searchInput.addEventListener("input", function (event) {
        memberSearchTerm = event.target.value || "";
        renderUsersList(deps);
      });
    }

    if (levelSelect) {
      levelSelect.value = memberLevelFilter;
      levelSelect.addEventListener("change", function (event) {
        memberLevelFilter = event.target.value || "";
        renderUsersList(deps);
      });
    }

    const newListBody = refs.userList.querySelector(".member-card-list");
    if (newListBody) {
      newListBody.scrollTop = previousScroll;
    } else {
      const newListColumn = refs.userList.querySelector(".user-list-column");
      if (newListColumn) {
        newListColumn.scrollTop = previousScroll;
      }
    }

    if (wasSearchFocused && searchInput) {
      searchInput.focus({ preventScroll: true });
      const end = searchInput.value.length;
      try {
        searchInput.setSelectionRange(end, end);
      } catch (e) {
        // ignore selection errors on some browsers
      }
    }

    refs.userList.querySelectorAll(".user-item").forEach(function (item) {
      item.addEventListener("click", function (event) {
        const id = item.dataset.userId;
        if (!id) return;
        selectedUserId = id;
        renderUsersList(deps);
      });
    });
  }

  function syncUserManagementControls(deps) {
    const { refs, state, isAdmin, isGlobalAdmin, levelLabel, escapeHtml, field } = deps;
    if (!refs.addUserForm) {
      return;
    }
    const canManageUsers = isAdmin(state.currentUser);
    const canAssignLevel = isGlobalAdmin(state.currentUser);
    const reason = "Admin only.";
    const levelField = field(refs.addUserForm, "level");
    if (levelField) {
      const levelsArray = Array.isArray(deps.levels) ? deps.levels.slice() : [];
      const uniqueSortedLevels = Array.from(new Set(levelsArray)).sort((a, b) => a - b);
      levelField.innerHTML = uniqueSortedLevels
        .map(
          (level) =>
            `<option value="${level}">${escapeHtml(levelLabel(level))}</option>`
        )
        .join("");
      levelField.disabled = !canAssignLevel || !canManageUsers;
      levelField.title = canAssignLevel && canManageUsers ? "" : "Admin only.";
      if (!canAssignLevel && uniqueSortedLevels.length) {
        levelField.value = String(uniqueSortedLevels[0]);
      }
    }
    refs.addUserForm.querySelectorAll("input, select, button").forEach(function (el) {
      if (el === levelField) {
        return;
      }
      if (el.tagName === "BUTTON") {
        el.title = canManageUsers ? "" : reason;
      } else if (el.tagName === "INPUT" || el.tagName === "SELECT") {
        el.title = canManageUsers ? "" : reason;
      }
      el.disabled = !canManageUsers;
    });

    if (refs.levelLabelsForm) {
      refs.levelLabelsForm.hidden = !isGlobalAdmin(state.currentUser);
      refs.levelLabelsForm
        .querySelectorAll("input[name^='level_']")
        .forEach(function (input) {
          const level = Number(input.name.split("_")[1]);
          input.value = levelLabel(level);
          input.disabled = !isGlobalAdmin(state.currentUser);
        });
      const submitButton = refs.levelLabelsForm.querySelector("button");
      if (submitButton) {
        submitButton.disabled = !isGlobalAdmin(state.currentUser);
      }
    }
  }

  window.usersModal = {
    openUsersModal,
    closeUsersModal,
    setUserFeedback,
    renderUsersList,
    syncUserManagementControls,
    setDetailEditState,
  };
})();
