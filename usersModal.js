(function () {
  let selectedUserId = null;
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
    }

    const selectedUser = state.users.find((u) => u.id === selectedUserId) || state.users[0];

    const previousScroll =
      refs.userList.querySelector(".member-card-list")?.scrollTop ??
      refs.userList.querySelector(".user-list-column")?.scrollTop ??
      0;
    const wasSearchFocused =
      document.activeElement &&
      document.activeElement.classList &&
      document.activeElement.classList.contains("member-card-search");

    const searchValue = (memberSearchTerm || "").trim().toLowerCase();
    const officeNames = new Map(
      (state.officeLocations || []).map((loc) => [loc.id != null ? String(loc.id) : "", loc.name || ""])
    );
    const departmentNames = new Map(
      (state.departments || []).map((dept) => [dept.id != null ? String(dept.id) : "", dept.name || ""])
    );
    const officeNameFor = (id) => {
      if (id === undefined || id === null) return "";
      const key = String(id);
      return officeNames.get(key) || "";
    };
    const departmentNameFor = (id) => {
      if (id === undefined || id === null) return "";
      const key = String(id);
      return departmentNames.get(key) || "";
    };
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
            const officeName = officeNameFor(user.officeId);
            const departmentName = departmentNameFor(user.departmentId);

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
                    ${officeName ? `<span>${escapeHtml(officeName)}</span>` : ""}
                    ${departmentName ? `<span>${escapeHtml(departmentName)}</span>` : ""}
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
    const departmentName = departmentNameFor(selectedUser.departmentId);
    const officeName = officeNameFor(selectedUser.officeId);
    const detailHtml = `
      <div class="user-detail-card">
        <h4>${escapeHtml(selectedUser.displayName)}</h4>
        <div class="detail-top-divider"></div>
        <dl>
          <div class="member-top-row">
            <div class="member-top-item">
              <dt>Level</dt>
              <dd>${escapeHtml(levelLabel(selectedUser.level))}</dd>
            </div>
            <div class="member-top-item">
              <dt>Department</dt>
              <dd>${departmentName || "—"}</dd>
            </div>
            <div class="member-top-item">
              <dt>Office</dt>
              <dd>${officeName || "—"}</dd>
            </div>
          </div>
          <div class="detail-divider"></div>
          <div><dt>Clients/Projects</dt><dd>${assignments.projects.length ? assignments.projects.map((p) => `${escapeHtml(p.client)} / ${escapeHtml(p.project)}`).join("<br>") : "None assigned"}</dd></div>
        </dl>
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
  };
})();
