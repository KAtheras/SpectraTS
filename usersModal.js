(function () {
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
    const { refs, state, levelLabel, isAdmin, isGlobalAdmin, isManager, escapeHtml, disabledButtonAttrs } =
      deps;

    if (!refs.userList) {
      return;
    }

    if (!state.users.length) {
      refs.userList.innerHTML = '<p class="empty-state">No team members yet.</p>';
      return;
    }

    refs.userList.innerHTML = state.users
      .map(function (user) {
        const roleLabelText = levelLabel(user.level);
        const isCurrentUser = state.currentUser?.id === user.id;
        const canManageUsers = isAdmin(state.currentUser);
        const canEditUser = canManageUsers;
        const canChangeRole = isGlobalAdmin(state.currentUser);
        const canResetPassword = canManageUsers;
        const canDeactivate = canManageUsers && !isCurrentUser;
        const canAssignManager = canManageUsers && (isManager(user) || isAdmin(user));
        const disabledReason = "Admin only.";
        const changeLevelReason = "Level 6 only.";

        return `
          <article class="catalog-item user-item">
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
