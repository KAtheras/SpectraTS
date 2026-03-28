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

  function normalizeOverrideValue(raw) {
    if (raw === undefined || raw === null) {
      return null;
    }
    const trimmed = String(raw).trim();
    if (!trimmed) {
      return null;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  function hasMemberChanges(refs, memberModalState) {
    const mode = memberModalState.mode;
    const gatingModes = new Set([
      "project-members-edit",
      "project-managers-edit",
      "project-add",
      "project-remove",
      "project-assign-manager",
      "project-unassign-manager",
    ]);
    if (!gatingModes.has(mode)) {
      // Do not gate other modal modes; allow Save by default.
      return true;
    }
    if (!refs.membersList) {
      return false;
    }

    const initialAssigned = new Set(memberModalState.initialAssigned || []);
    const currentChecked = new Set(
      Array.from(refs.membersList.querySelectorAll("input[type='checkbox'][data-member-id]"))
        .filter((input) => input.checked)
        .map((input) => input.dataset.memberId)
    );

    if (initialAssigned.size !== currentChecked.size) {
      return true;
    }
    for (const id of initialAssigned) {
      if (!currentChecked.has(id)) {
        return true;
      }
    }

    const initialOverrides = memberModalState.initialOverrides || {};
    const currentOverrides = {};
    Array.from(refs.membersList.querySelectorAll("input[data-override-input]")).forEach(
      (input) => {
        currentOverrides[input.dataset.overrideInput] = normalizeOverrideValue(input.value);
      }
    );

    const allIds = new Set([
      ...Object.keys(initialOverrides || {}),
      ...Object.keys(currentOverrides),
    ]);
    for (const id of allIds) {
      const prev = normalizeOverrideValue(initialOverrides[id]);
      const curr = normalizeOverrideValue(currentOverrides[id]);
      if (prev !== curr) {
        return true;
      }
    }

    return false;
  }

  function syncMembersSaveState(refs, memberModalState) {
    if (!refs.membersConfirm) {
      return;
    }
    const changed = hasMemberChanges(refs, memberModalState);
    refs.membersConfirm.disabled = !changed;
    refs.membersConfirm.setAttribute("aria-disabled", changed ? "false" : "true");
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
    memberModalState.assigned = [];
    memberModalState.overrides = {};
    memberModalState.initialAssigned = [];
    memberModalState.initialOverrides = {};
    memberModalState.initialAssigned = [];
    memberModalState.initialOverrides = {};

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
      levels,
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
      roleKey,
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
    const overrideMap = memberModalState.overrides || {};

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
    const officeNameById = new Map(
      (state.officeLocations || []).map((loc) => [loc.id || "", loc.name || ""])
    );

    const grouped = new Map();

    usersToRender.forEach(function (user) {
      const currentLevel = normalizeLevel(user.level);
      const isManagerEligible = isManager(user);
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
        const isEligible = isManagerEligible;
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
        show = isAssignedToClient && isManagerEligible;
        checkboxChecked = show;
      } else if (mode === "project-assign-manager") {
        const isEligible = isManagerEligible;
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
        show = isDirectAssignedToProject && isManagerEligible;
        checkboxChecked = show;
      } else if (mode === "project-managers-edit") {
        show = isManagerEligible;
        checkboxChecked = assignedSet.has(user.id);
      } else if (mode === "user-role") {
        checkboxDisabled = true;
        checkboxChecked = true;
      }

      if (!show) {
        return;
      }

      const levelChoices =
        Array.isArray(levels) && levels.length
          ? Array.from(new Set(levels)).sort((a, b) => a - b)
          : [];

      const roleSelect = canChangeRole
        ? `
          <label class="member-role">
            <span class="sr-only">Level</span>
            <select data-level-select="${escapeHtml(user.id)}">
              ${levelChoices
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

      const baseRate =
        user.baseRate !== undefined && user.baseRate !== null
          ? Number(user.baseRate)
          : user.base_rate !== undefined && user.base_rate !== null
            ? Number(user.base_rate)
            : null;
      const overrideRate =
        overrideMap[user.id] !== undefined && overrideMap[user.id] !== null
          ? Number(overrideMap[user.id])
          : null;
      const effectiveRate =
        overrideRate !== null ? overrideRate : baseRate !== null ? baseRate : null;
      const formatRate = (value) =>
        value === null || Number.isNaN(value) ? "—" : `$${Number(value).toFixed(2)}`;

      const overrideRow =
        mode === "project-members-edit" || mode === "project-managers-edit"
          ? `
              <div class="member-rate">
                <div class="member-rate-line">Base Rate: ${formatRate(baseRate)}</div>
                <label class="member-rate-input" data-rate-override="${escapeHtml(user.id)}" style="${checkboxChecked ? "" : "display:none;"}">
                  <span>Project Rate Override (optional)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    data-override-input="${escapeHtml(user.id)}"
                    value="${overrideRate !== null ? escapeHtml(String(overrideRate)) : ""}"
                    placeholder="Use base rate"
                  />
                </label>
                <div class="member-rate-line" data-effective-wrapper="${escapeHtml(
                  user.id
                )}" style="${checkboxChecked ? "" : "display:none;"}">
                  Effective: <span data-effective-rate="${escapeHtml(
                    user.id
                  )}">${formatRate(effectiveRate)}</span>
                </div>
              </div>
            `
          : "";

      const officeId = user.officeId || "";
      const groupKey = officeId || "__no_office";
      const officeLabel = officeId
        ? officeNameById.get(officeId) || officeId
        : "No Office";

      const rowHtml = `
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
            ${overrideRow}
          </div>
        </article>
      `;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { label: officeLabel, rows: [] });
      }
      grouped.get(groupKey).rows.push(rowHtml);
    });

    const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
      if (a.label === "No Office") return 1;
      if (b.label === "No Office") return -1;
      return a.label.localeCompare(b.label);
    });

    const html = sortedGroups
      .map(
        (group) => `
          <div class="member-group">
            <h3 class="member-group-title">${escapeHtml(group.label)}</h3>
            ${group.rows.join("")}
          </div>
        `
      )
      .join("");
    refs.membersList.innerHTML = html || '<p class="empty-state">No matching members.</p>';

    refs.membersList.oninput = function (event) {
      const input = event.target.closest("input[data-override-input]");
      if (input) {
        const userId = input.dataset.overrideInput;
        const effectiveSpan = refs.membersList.querySelector(
          `[data-effective-rate="${userId}"]`
        );
        if (effectiveSpan) {
          const baseLine = effectiveSpan.closest(".member-rate").querySelector(".member-rate-line");
          const baseMatch = baseLine ? /\$([0-9.]+)/.exec(baseLine.textContent) : null;
          const baseValue = baseMatch ? Number(baseMatch[1]) : null;
          const raw = input.value.trim();
          const num = raw === "" ? null : Number(raw);
          const effective = num !== null && Number.isFinite(num) ? num : baseValue;
          effectiveSpan.textContent =
            effective === null || Number.isNaN(effective) ? "—" : `$${Number(effective).toFixed(2)}`;
        }
      }
      syncMembersSaveState(refs, memberModalState);
    };

    refs.membersList.onchange = function (event) {
      const checkbox = event.target.closest("input[type='checkbox'][data-member-id]");
      if (checkbox) {
        const userId = checkbox.dataset.memberId;
        const overrideLabel = refs.membersList.querySelector(
          `[data-rate-override="${userId}"]`
        );
        const effectiveLine = refs.membersList.querySelector(
          `[data-effective-wrapper="${userId}"]`
        );
        if (overrideLabel) {
          overrideLabel.style.display = checkbox.checked ? "" : "none";
        }
        if (effectiveLine) {
          effectiveLine.style.display = checkbox.checked ? "" : "none";
        }
      }
      syncMembersSaveState(refs, memberModalState);
    };

    syncMembersSaveState(refs, memberModalState);
  }

  window.membersModal = {
    openMembersModal,
    closeMembersModal,
    renderMembersModal,
  };
})();
