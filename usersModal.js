(function () {
  let selectedUserId = null;
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

    const listHtml = state.users
      .map(function (user) {
        const roleLabelText = levelLabel(user.level);
        const isCurrentUser = state.currentUser?.id === user.id;
        const canManageUsers = isAdmin(state.currentUser);
        const canEditUser = canManageUsers;
        const canChangeRole = isGlobalAdmin(state.currentUser);
        const canResetPassword = canManageUsers;
        const canDeactivate = canManageUsers && !isCurrentUser;
        const disabledReason = "Admin only.";
        const changeLevelReason = "Level 6 only.";
        const isSelected = selectedUserId === user.id;

        return `
          <article class="catalog-item user-item ${isSelected ? "is-selected" : ""}" data-user-id="${escapeHtml(user.id)}">
            <span class="catalog-item-copy">
              <span class="catalog-item-title">${escapeHtml(user.displayName)}</span>
              <span class="user-item-meta">
                <span>${escapeHtml(user.username)}</span>
                <span>${escapeHtml(roleLabelText)}</span>
                ${isCurrentUser ? "<span>Current session</span>" : ""}
              </span>
            </span>
            <span class="user-item-actions">
              <button
                type="button"
                class="catalog-edit"
                data-user-edit="${escapeHtml(user.id)}"
                ${disabledButtonAttrs(canEditUser, disabledReason)}
              >
                Edit
              </button>
              <button
                type="button"
                class="catalog-edit"
                data-user-role="${escapeHtml(user.id)}"
                ${disabledButtonAttrs(canChangeRole, changeLevelReason)}
              >
                Change level
              </button>
              <button
                type="button"
                class="catalog-edit"
                data-user-password="${escapeHtml(user.id)}"
                ${disabledButtonAttrs(canResetPassword, disabledReason)}
              >
                Reset password
              </button>
              ${
                isCurrentUser
                  ? ""
                  : `<button
                      type="button"
                      class="catalog-delete"
                      data-user-deactivate="${escapeHtml(user.id)}"
                      ${disabledButtonAttrs(canDeactivate, disabledReason)}
                    >
                      Deactivate
                    </button>`
              }
            </span>
          </article>
        `;
      })
      .join("");

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
      const detailHtml = `
        <div class="user-detail-card">
          <h4>${escapeHtml(selectedUser.displayName)}</h4>
          <dl>
            <div><dt>Level</dt><dd>${escapeHtml(levelLabel(selectedUser.level))}</dd></div>
            <div><dt>Base Rate</dt><dd>${selectedUser.baseRate !== null && selectedUser.baseRate !== undefined ? `$${Number(selectedUser.baseRate).toFixed(2)}` : "—"}</dd></div>
            <div><dt>Cost Rate</dt><dd>${selectedUser.costRate !== null && selectedUser.costRate !== undefined ? `$${Number(selectedUser.costRate).toFixed(2)}` : "—"}</dd></div>
            <div><dt>Clients/Projects</dt><dd>${assignments.projects.length ? assignments.projects.map((p) => `${escapeHtml(p.client)} / ${escapeHtml(p.project)}`).join("<br>") : "—"}</dd></div>
          </dl>
        </div>
      `;

    refs.userList.innerHTML = `
      <div class="user-pane">
        <div class="user-list-column">${listHtml}</div>
        <div class="user-detail-column">${detailHtml}</div>
      </div>
    `;

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
      levelField.innerHTML = [1, 2, 3, 4, 5, 6]
        .map(
          (level) =>
            `<option value="${level}">${escapeHtml(levelLabel(level))}</option>`
        )
        .join("");
      levelField.disabled = !canAssignLevel || !canManageUsers;
      levelField.title = canAssignLevel && canManageUsers ? "" : "Admin only.";
      if (!canAssignLevel) {
        levelField.value = "1";
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
