(function () {
  function openMembersModal(deps) {
    const { refs, body, renderMembersModal, memberModalState, postHeight } = deps;
    if (!refs.membersModal) {
      return;
    }
    refs.membersModal.dataset.mode = memberModalState.mode || "";
    refs.membersFeedback.textContent = "";
    refs.membersFeedback.dataset.error = "false";
    refs.membersModal.hidden = false;
    refs.membersModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    renderMembersModal();
    postHeight();
  }

  function closeMembersModal(deps) {
    const { refs, body, memberModalState, postHeight } = deps;
    if (!refs.membersModal) {
      return;
    }
    refs.membersModal.hidden = true;
    refs.membersModal.setAttribute("aria-hidden", "true");
    refs.membersModal.dataset.mode = "";
    memberModalState.mode = "";
    memberModalState.client = "";
    memberModalState.project = "";
    memberModalState.userId = "";

    const usersHidden = !refs.usersModal || refs.usersModal.hidden;
    const catalogHidden = !refs.catalogModal || refs.catalogModal.hidden;
    if (usersHidden && catalogHidden) {
      body.classList.remove("modal-open");
    }
    postHeight();
  }

  function renderMembersModal(deps) {
    const {
      refs,
      state,
      memberModalState,
      isGlobalAdmin,
      isStaff,
      isManager,
      levelLabel,
      normalizeLevel,
      getUserById,
      directManagerIdsForProject,
      isUserAssignedToProject,
      managerIdsForProject,
      staffIdsForProject,
      managerIdsForClientScope,
      staffIdsForClient,
      escapeHtml,
    } = deps;

    if (!refs.membersList || !refs.membersTitle || !refs.membersSubtext) {
      return;
    }
    const mode = memberModalState.mode;
    const client = memberModalState.client;
    const project = memberModalState.project;
    const userId = memberModalState.userId;
    const assignedSet = new Set(memberModalState.assigned || []);

    let title = "Manage Members";
    let subtext = "";
    if (mode === "project-add" || mode === "project-members-edit") {
      title = `Add Members to ${project}`;
      subtext = "Select staff to add to this project.";
    } else if (mode === "project-remove") {
      title = `Remove Members from ${project}`;
      subtext = "Select staff to remove from this project.";
    } else if (mode === "project-members-edit") {
      title = `Manage Members for ${project}`;
      subtext = "Edit assigned members by checking or unchecking their boxes.";
    } else if (mode === "client-assign") {
      title = `Assign Managers to ${client}`;
      subtext =
        "Select managers or global admins who should have access to every project under this client.";
    } else if (mode === "client-unassign") {
      title = `Unassign Managers from ${client}`;
      subtext = "Select managers to remove from this client.";
    } else if (mode === "project-assign-manager" || mode === "project-managers-edit") {
      title = `Assign Managers to ${project}`;
      subtext = "Select managers or global admins who should have access to this project.";
    } else if (mode === "project-unassign-manager") {
      title = `Unassign Managers from ${project}`;
      subtext = "Select managers to remove from this project.";
    } else if (mode === "project-managers-edit") {
      title = `Manage Managers for ${project}`;
      subtext = "Edit assigned managers by checking or unchecking their boxes.";
    } else if (mode === "user-role") {
      const targetUser = getUserById(userId);
      title = `Change Level for ${targetUser ? targetUser.displayName : "Team Member"}`;
      subtext = "Choose the level for this team member.";
    }

    refs.membersTitle.textContent = title;
    refs.membersSubtext.textContent = subtext;

    const canChangeRole = isGlobalAdmin(state.currentUser) && mode === "user-role";
    const usersToRender =
      mode === "user-role" && userId
        ? state.users.filter((user) => user.id === userId)
        : state.users;
    const rows = usersToRender.map(function (user) {
      const currentLevel = normalizeLevel(user.level);
      const isAssignedToProject = project
        ? isUserAssignedToProject(user.id, client, project)
        : false;
      const isDirectAssignedToProject =
        project && mode.startsWith("project-")
          ? directManagerIdsForProject(client, project).includes(user.id)
          : false;
      const isAssignedToClient = client
        ? state.assignments.managerClients.some(
            (item) => item.managerId === user.id && item.client === client
          )
        : false;

      let checkboxDisabled = false;
      let checkboxTitle = "";
      let show = true;
      let checkboxChecked = false;

      if (mode === "project-add") {
        if (isAssignedToProject) {
          checkboxDisabled = true;
          checkboxTitle = "Already assigned.";
        } else if (!isStaff(user) && !canChangeRole) {
          checkboxDisabled = true;
          checkboxTitle = "Managers can only assign staff.";
        }
      } else if (mode === "project-remove") {
        show = isAssignedToProject && isStaff(user);
        checkboxChecked = show;
      } else if (mode === "project-members-edit") {
        show = isStaff(user);
        checkboxChecked = assignedSet.has(user.id);
      } else if (mode === "client-assign") {
        const isEligible = normalizeLevel(user.level) >= 3;
        show = isEligible;
        if (!isEligible) {
          checkboxDisabled = true;
          checkboxTitle = "Managers or higher only.";
        }
        if (isAssignedToClient) {
          checkboxDisabled = true;
          checkboxTitle = "Already assigned.";
        }
      } else if (mode === "client-unassign") {
        show = isAssignedToClient && normalizeLevel(user.level) >= 3;
        checkboxChecked = show;
      } else if (mode === "project-assign-manager") {
        const isEligible = normalizeLevel(user.level) >= 3;
        show = isEligible;
        if (!isEligible) {
          checkboxDisabled = true;
          checkboxTitle = "Managers or higher only.";
        }
        if (isDirectAssignedToProject) {
          checkboxDisabled = true;
          checkboxTitle = "Already assigned.";
        }
      } else if (mode === "project-unassign-manager") {
        show = isDirectAssignedToProject && normalizeLevel(user.level) >= 3;
        checkboxChecked = show;
      } else if (mode === "project-managers-edit") {
        show = normalizeLevel(user.level) >= 3;
        checkboxChecked = assignedSet.has(user.id);
      } else if (mode === "user-role") {
        checkboxDisabled = true;
        checkboxChecked = true;
      }

      if (!show) {
        return "";
      }

      const roleSelect = canChangeRole
        ? `
          <label class="member-role">
            <span class="sr-only">Level</span>
            <select data-level-select="${escapeHtml(user.id)}">
              ${[1, 2, 3, 4, 5, 6]
                .map(
                  (level) =>
                    `<option value="${level}"${
                      currentLevel === level ? " selected" : ""
                    }>${escapeHtml(levelLabel(level))}</option>`
                )
                .join("")}
            </select>
          </label>
        `
        : `<span class="member-role-label">${escapeHtml(levelLabel(user.level))}</span>`;

      return `
        <article class="catalog-item member-item">
          <label class="member-select">
            <input
              type="checkbox"
              data-member-id="${escapeHtml(user.id)}"
              ${checkboxChecked ? "checked" : ""}
              ${checkboxDisabled ? "disabled" : ""}
              ${checkboxTitle ? `title="${escapeHtml(checkboxTitle)}"` : ""}
            />
            <span class="member-name">${escapeHtml(user.displayName)}</span>
            <span class="member-username">${escapeHtml(user.username)}</span>
          </label>
          <div class="member-controls">
            ${roleSelect}
          </div>
        </article>
      `;
    });

    const html = rows.filter(Boolean).join("");
    refs.membersList.innerHTML = html || '<p class="empty-state">No matching members.</p>';
  }

  window.membersModal = {
    openMembersModal,
    closeMembersModal,
    renderMembersModal,
  };
})();
